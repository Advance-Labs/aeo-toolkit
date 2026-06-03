/**
 * Background service worker — the audit orchestrator.
 *
 * On a RUN_AUDIT request from the popup it:
 *   1. resolves the active tab,
 *   2. reads the live DOM from the content script (injecting it if the page
 *      loaded before the extension, via the `scripting` permission),
 *   3. fetches the origin's robots.txt / sitemap.xml / llms.txt (same-origin),
 *   4. runs the entire client-side scoring pipeline,
 *   5. returns a finished AuditPayload (or a structured error).
 *
 * No analysis crosses the network — only the same-origin crawl-hint file probes.
 */
import { runAudit, originOf } from '../lib/audit.js';
import { isRuntimeMessage } from '../lib/messages.js';
import type { AuditResponse, ReadDomResponse, RuntimeMessage } from '../lib/messages.js';
import { HttpSiteFileFetcher } from '../lib/site-files.js';

const fetcher = new HttpSiteFileFetcher();

chrome.runtime.onMessage.addListener(
  (
    message: unknown,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: AuditResponse) => void,
  ): boolean => {
    if (!isRuntimeMessage(message)) return false;
    const msg = message as RuntimeMessage;
    if (msg.type !== 'RUN_AUDIT') return false;

    void handleRunAudit()
      .then((payloadResponse) => sendResponse(payloadResponse))
      .catch((err: unknown) =>
        sendResponse({ type: 'AUDIT_RESULT', ok: false, error: errorMessage(err) }),
      );

    return true; // async response → keep the channel open
  },
);

async function handleRunAudit(): Promise<AuditResponse> {
  const startedAtMs = Date.now();

  const tab = await activeTab();
  if (tab?.id === undefined || !tab.url) {
    return { type: 'AUDIT_RESULT', ok: false, error: 'No active tab to audit.' };
  }
  if (!/^https?:/i.test(tab.url)) {
    return {
      type: 'AUDIT_RESULT',
      ok: false,
      error: 'This page cannot be audited (only http/https pages are supported).',
    };
  }

  const dom = await readDom(tab.id);
  if (dom === null) {
    return {
      type: 'AUDIT_RESULT',
      ok: false,
      error: 'Could not read the page DOM. Reload the tab and try again.',
    };
  }

  const origin = originOf(dom.url);
  const siteFiles = await fetcher.fetchSiteFiles(origin);

  const payload = await runAudit({
    pageUrl: dom.url,
    html: dom.html,
    siteFiles,
    startedAtMs,
  });

  return { type: 'AUDIT_RESULT', ok: true, payload };
}

/** Resolve the currently active tab in the focused window. */
async function activeTab(): Promise<chrome.tabs.Tab | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

/**
 * Ask the content script for the live DOM. If the content script was not yet
 * present (page loaded before install/update), inject it with `chrome.scripting`
 * and retry once.
 */
async function readDom(tabId: number): Promise<ReadDomResponse | null> {
  const got = await requestDom(tabId);
  if (got !== null) return got;

  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['src/content/index.ts'],
    });
  } catch {
    return null;
  }
  return requestDom(tabId);
}

async function requestDom(tabId: number): Promise<ReadDomResponse | null> {
  try {
    const response = (await chrome.tabs.sendMessage(tabId, { type: 'READ_DOM' })) as unknown;
    if (isRuntimeMessage(response) && (response as RuntimeMessage).type === 'READ_DOM_RESULT') {
      return response as ReadDomResponse;
    }
    return null;
  } catch {
    return null;
  }
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  return 'Audit failed unexpectedly.';
}
