/** MCP domain — shared shapes for `@advance-labs/mcp-core` and the three MCP servers. */
import type { Url } from './crawl.js';
import type { Citation } from './llm.js';

export interface RateLimitConfig {
  capacity: number;
  refillPerSec: number;
}

export interface McpServerOptions {
  name: string;
  version: string;
  rateLimit?: RateLimitConfig;
}

/** A single MCP tool: name, description, an input schema (zod/JSON-schema), and a handler. */
export interface McpToolDefinition<TInput = unknown, TOutput = unknown> {
  name: string;
  description: string;
  inputSchema: unknown;
  handler: (input: TInput) => Promise<TOutput>;
}

/** AI-visibility check result (ai-visibility-mcp tool 4). */
export interface VisibilityCheck {
  prompt: string;
  url: Url;
  cited: boolean;
  citationRank?: number;
  citations: Citation[];
  model: string;
}

export interface CompetitorVisibility {
  prompt: string;
  results: { url: Url; cited: boolean; rank?: number }[];
}
