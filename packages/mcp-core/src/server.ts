/**
 * Server + tool-registry helpers — thin, typed wrappers over the official
 * `@modelcontextprotocol/sdk` so the three AEO MCP servers share one setup path.
 *
 * The SDK's public surface is wrapped behind small adapters here. If the SDK API
 * shifts between minor versions, this is the single place that needs updating;
 * the pure logic in `rate-limit.ts`, `oauth.ts`, and `errors.ts` is unaffected.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { z, ZodRawShape } from 'zod';
import type { McpServerOptions } from '@advance-labs/types';

import { RateLimiter } from './rate-limit.js';
import { toToolError, type ToolErrorResult } from './errors.js';

/** A single text content block returned by a tool handler. */
export interface ToolTextContent {
  type: 'text';
  text: string;
}

/** Success-flavoured tool result. `toToolError` produces the error counterpart. */
export interface ToolSuccessResult {
  content: ToolTextContent[];
  isError?: false;
  structuredContent?: Record<string, unknown>;
}

export type ToolResult = ToolSuccessResult | ToolErrorResult;

/**
 * A registry-friendly tool definition.
 *
 * Unlike the loosely-typed `McpToolDefinition` in `@advance-labs/types` (whose `inputSchema`
 * is `unknown`), this carries a concrete Zod raw shape so the handler receives
 * fully-typed, validated arguments. `TShape` is the object of zod fields the SDK
 * validates against (e.g. `{ url: z.string() }`).
 */
export interface McpToolDef<TShape extends ZodRawShape> {
  name: string;
  title?: string;
  description: string;
  /** A Zod raw shape — a plain object of zod field schemas. */
  inputSchema: TShape;
  /** Handler receives validated args; return a `ToolResult` (success or error). */
  handler: (args: ShapeInput<TShape>) => Promise<ToolResult> | ToolResult;
}

/** Derive the validated argument object type from a Zod raw shape. */
export type ShapeInput<TShape extends ZodRawShape> = z.infer<z.ZodObject<TShape>>;

/** An MCP server instance plus the rate limiter guarding its tool calls. */
export interface CreatedServer {
  server: McpServer;
  rateLimiter?: RateLimiter;
}

/**
 * Create an `McpServer` configured from `McpServerOptions`. A token-bucket
 * `RateLimiter` is attached when `opts.rateLimit` is provided; `registerTool`
 * consults it before invoking handlers.
 */
export function createServer(opts: McpServerOptions): CreatedServer {
  const server = new McpServer({ name: opts.name, version: opts.version });
  const rateLimiter = opts.rateLimit ? new RateLimiter(opts.rateLimit) : undefined;
  return { server, rateLimiter };
}

/**
 * Register a tool on the server. Wraps the handler so that:
 *  - rate-limit exhaustion returns a structured tool error (never throws),
 *  - any thrown value is normalised via `toToolError`,
 *  - the result is shaped to the SDK's `CallToolResult` contract.
 *
 * Accepts either a `CreatedServer` (to honour its rate limiter) or a bare
 * `McpServer`.
 */
export function registerTool<TShape extends ZodRawShape>(
  target: CreatedServer | McpServer,
  def: McpToolDef<TShape>,
): void {
  const created: CreatedServer = target instanceof McpServer ? { server: target } : target;
  const { server, rateLimiter } = created;

  // STUB: the SDK's ToolCallback arg/return types are intentionally widened to
  // `unknown`/`Record` at this seam so a minor SDK signature drift cannot break
  // compilation. Validated args are produced by the SDK from `inputSchema`.
  const sdkCallback = async (args: unknown): Promise<unknown> => {
    if (rateLimiter && !rateLimiter.tryRemove()) {
      return toToolError(
        new Error(`Rate limit exceeded for tool "${def.name}". Try again shortly.`),
      );
    }
    try {
      return await def.handler(args as ShapeInput<TShape>);
    } catch (err) {
      return toToolError(err);
    }
  };

  const config: {
    title?: string;
    description: string;
    inputSchema: TShape;
  } = {
    description: def.description,
    inputSchema: def.inputSchema,
  };
  if (def.title !== undefined) {
    config.title = def.title;
  }

  // The SDK's registerTool generic is keyed on the raw shape; the widened
  // callback is accepted as a ToolCallback.
  server.registerTool(def.name, config, sdkCallback as Parameters<McpServer['registerTool']>[2]);
}
