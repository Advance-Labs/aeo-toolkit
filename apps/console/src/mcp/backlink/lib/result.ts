/**
 * Helpers for shaping backlink tool results.
 *
 * Every tool returns a JSON payload as a single text content block AND mirrors it
 * into `structuredContent` so MCP clients that support structured tool output get
 * machine-readable data while text-only clients still see the JSON. Soft failures
 * (a blocked scrape, an empty parse) are surfaced as a `warnings[]` array inside
 * the payload — never as a thrown error or an MCP error result. Hard, structured
 * errors still use `toToolError` from `@advance-labs/mcp-core`.
 */
import type { ToolResult } from '@advance-labs/mcp-core';

/** A JSON-serialisable value. */
export type Json = string | number | boolean | null | Json[] | { [key: string]: Json | undefined };

/**
 * Wrap a JSON-serialisable payload as an MCP success result. The payload is
 * pretty-printed into a text block and also attached as `structuredContent`.
 */
export function jsonResult(payload: Record<string, Json | undefined>): ToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
    structuredContent: payload as Record<string, unknown>,
  };
}
