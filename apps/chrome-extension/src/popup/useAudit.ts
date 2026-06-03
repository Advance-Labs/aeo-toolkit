/**
 * Popup-side audit driver. Sends RUN_AUDIT to the background worker and exposes
 * the lifecycle (idle → running → done/error) to the UI.
 *
 * The transport (`runAuditViaRuntime`) is injectable so the hook can be unit-
 * tested with a fake that never touches `chrome.*`.
 */
import { useCallback, useState } from 'react';
import type { AuditResponse, RunAuditRequest } from '../lib/messages.js';
import type { AuditPayload } from '../lib/types.js';

export type AuditState =
  | { status: 'idle' }
  | { status: 'running' }
  | { status: 'done'; payload: AuditPayload }
  | { status: 'error'; error: string };

/** Transport seam: send RUN_AUDIT and await the background worker's reply. */
export type AuditTransport = (request: RunAuditRequest) => Promise<AuditResponse>;

/** Default transport using the extension runtime message bus. */
export const runtimeTransport: AuditTransport = async (request) => {
  const response = (await chrome.runtime.sendMessage(request)) as unknown;
  if (isAuditResponse(response)) return response;
  return { type: 'AUDIT_RESULT', ok: false, error: 'Malformed response from background worker.' };
};

function isAuditResponse(value: unknown): value is AuditResponse {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { type?: unknown }).type === 'AUDIT_RESULT'
  );
}

export interface UseAuditResult {
  state: AuditState;
  run: () => Promise<void>;
}

export function useAudit(transport: AuditTransport = runtimeTransport): UseAuditResult {
  const [state, setState] = useState<AuditState>({ status: 'idle' });

  const run = useCallback(async () => {
    setState({ status: 'running' });
    try {
      const response = await transport({ type: 'RUN_AUDIT' });
      if (response.ok) {
        setState({ status: 'done', payload: response.payload });
      } else {
        setState({ status: 'error', error: response.error });
      }
    } catch (err) {
      setState({
        status: 'error',
        error: err instanceof Error ? err.message : 'Audit request failed.',
      });
    }
  }, [transport]);

  return { state, run };
}
