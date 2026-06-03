/**
 * Typed message protocol for the extension's three contexts.
 *
 * popup ──RUN_AUDIT──▶ background ──READ_DOM──▶ content (active tab)
 *                                  └─fetch site files (same-origin)─┐
 * popup ◀──AUDIT_RESULT─────────── background ◀────────────────────┘
 *
 * The background worker is the orchestrator: it asks the content script for the
 * live DOM, fetches the origin's crawl-hint files itself, then runs the entire
 * (client-side) scoring pipeline and returns a finished {@link AuditPayload}.
 */
import type { AuditPayload } from './types.js';

/** Sent popup → background to kick off an audit of the active tab. */
export interface RunAuditRequest {
  type: 'RUN_AUDIT';
}

/** Sent background → content to read the live DOM of the page it is injected into. */
export interface ReadDomRequest {
  type: 'READ_DOM';
}

/** Content → background reply carrying the serialized live DOM + page URL. */
export interface ReadDomResponse {
  type: 'READ_DOM_RESULT';
  url: string;
  html: string;
}

/** background → popup terminal result. Either an audit or a structured error. */
export type AuditResponse =
  | { type: 'AUDIT_RESULT'; ok: true; payload: AuditPayload }
  | { type: 'AUDIT_RESULT'; ok: false; error: string };

export type RuntimeMessage = RunAuditRequest | ReadDomRequest | ReadDomResponse | AuditResponse;

/** Type guard: narrow an unknown runtime message to a discriminated member. */
export function isRuntimeMessage(value: unknown): value is RuntimeMessage {
  if (typeof value !== 'object' || value === null) return false;
  const t = (value as { type?: unknown }).type;
  return t === 'RUN_AUDIT' || t === 'READ_DOM' || t === 'READ_DOM_RESULT' || t === 'AUDIT_RESULT';
}
