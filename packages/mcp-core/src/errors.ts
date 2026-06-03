/**
 * Structured error helpers for MCP tool handlers.
 *
 * MCP tools must never throw silently or return ad-hoc shapes: they return a
 * `CallToolResult` with `isError: true` so the calling LLM can see the failure
 * and self-correct. `toToolError` normalises any thrown value into that shape.
 */

/** A single text content block in an MCP tool result. */
export interface ToolTextContent {
  type: 'text';
  text: string;
}

/** The error-flavoured `CallToolResult` shape returned to MCP clients. */
export interface ToolErrorResult {
  isError: true;
  content: ToolTextContent[];
}

/** Typed error subclass MCP servers can throw for first-class structured errors. */
export class McpToolError extends Error {
  /** Optional machine-readable code surfaced to operators (not the LLM contract). */
  readonly code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = 'McpToolError';
    this.code = code;
    // Maintain prototype chain when compiled to older targets.
    Object.setPrototypeOf(this, McpToolError.prototype);
  }
}

/** Extract a human-readable message from an unknown thrown value without using `any`. */
export function errorMessage(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }
  if (typeof err === 'string') {
    return err;
  }
  if (
    typeof err === 'object' &&
    err !== null &&
    'message' in err &&
    typeof (err as { message: unknown }).message === 'string'
  ) {
    return (err as { message: string }).message;
  }
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

/**
 * Normalise any thrown value into a structured MCP tool error result.
 *
 * @example
 * try { ... } catch (err) { return toToolError(err); }
 */
export function toToolError(err: unknown): ToolErrorResult {
  return {
    isError: true,
    content: [{ type: 'text', text: errorMessage(err) }],
  };
}
