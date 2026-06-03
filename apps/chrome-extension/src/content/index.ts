/**
 * Content script — runs in the page context of the active tab.
 *
 * Its only job is to hand the LIVE, fully-rendered DOM back to the background
 * worker on request. Reading `document.documentElement.outerHTML` captures the
 * post-JS state (SPAs, hydrated content), which is exactly what an answer engine
 * would see, so the audit reflects reality rather than the raw server HTML.
 */
import { isRuntimeMessage } from '../lib/messages.js';
import type { ReadDomResponse, RuntimeMessage } from '../lib/messages.js';

chrome.runtime.onMessage.addListener(
  (
    message: unknown,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: ReadDomResponse) => void,
  ): boolean => {
    if (!isRuntimeMessage(message)) return false;
    const msg = message as RuntimeMessage;
    if (msg.type !== 'READ_DOM') return false;

    const doctype = document.doctype ? '<!DOCTYPE html>\n' : '';
    const html = doctype + document.documentElement.outerHTML;
    sendResponse({
      type: 'READ_DOM_RESULT',
      url: document.location.href,
      html,
    });
    return true; // keep the message channel open for the (sync) response
  },
);
