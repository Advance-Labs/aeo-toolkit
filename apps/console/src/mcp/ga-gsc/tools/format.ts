/**
 * Result-shaping helpers: turn typed Google reports into MCP `ToolResult`s.
 *
 * Every tool returns BOTH a human-readable `text` block (what the LLM reads inline)
 * and a `structuredContent` object (machine-parseable for chained tool calls). The
 * structured payload is wrapped so the SDK's structured-content channel always
 * receives an object, never a bare array.
 */
import type { ToolResult } from '@aeo/mcp-core';

/** Wrap a JSON-serialisable payload into a success `ToolResult`. */
export function jsonResult(summary: string, structured: Record<string, unknown>): ToolResult {
  return {
    content: [{ type: 'text', text: `${summary}\n\n${JSON.stringify(structured, null, 2)}` }],
    structuredContent: structured,
  };
}

/** Round to a fixed number of decimals without floating-point noise in output. */
export function round(value: number, decimals = 4): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/** Format a ratio (0..1) as a percentage string with one decimal place. */
export function pct(ratio: number): string {
  return `${round(ratio * 100, 1).toFixed(1)}%`;
}
