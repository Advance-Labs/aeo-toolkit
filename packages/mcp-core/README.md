# @aeo/mcp-core

Shared kit for the AEO Toolkit's three MCP servers (`ai-visibility-mcp`, `ga-gsc-mcp`,
`backlink-mcp`), built on the official [`@modelcontextprotocol/sdk`](https://github.com/modelcontextprotocol/typescript-sdk).
It provides a one-call server factory, a tool registry that wraps handlers with token-bucket
rate limiting and structured errors, OAuth 2.1 `.well-known` discovery builders for Claude.ai
connector auto-registration, and thin transport mounters (stdio + HTTP/SSE).

## Usage

```ts
import { z } from 'zod';
import {
  createServer,
  registerTool,
  mountStdio,
  mountHttp,
  wellKnownOAuthMetadata,
  wellKnownProtectedResource,
  toToolError,
} from '@aeo/mcp-core';

const created = createServer({
  name: 'ai-visibility-mcp',
  version: '0.1.0',
  rateLimit: { capacity: 20, refillPerSec: 5 },
});

registerTool(created, {
  name: 'analyze_website_aeo',
  description: 'Score a URL for AI-readiness',
  inputSchema: { url: z.string().url() },
  handler: async ({ url }) => ({
    content: [{ type: 'text', text: `Analyzing ${url}` }],
  }),
});

// Local (Claude Desktop):
await mountStdio(created);

// Remote (Claude.ai connector, stateless serverless):
// const transport = await mountHttp(created);

// Serve from your route handler:
const asMeta = wellKnownOAuthMetadata({ issuer: 'https://mcp.example.com' });
const prMeta = wellKnownProtectedResource({
  resource: 'https://mcp.example.com',
  authorizationServers: ['https://auth.example.com'],
});
```

## Public API

| Export | Kind | Purpose |
|--------|------|---------|
| `createServer(opts)` | fn | Build an `McpServer` + optional `RateLimiter` from `McpServerOptions`. |
| `registerTool(target, def)` | fn | Register a tool; wraps the handler with rate limiting + structured errors. |
| `RateLimiter` | class | Token bucket (`tryRemove`, `available`); injectable `Clock` for tests. |
| `wellKnownOAuthMetadata(cfg)` | fn | RFC 8414 authorization-server discovery JSON (OAuth 2.1 + PKCE). |
| `wellKnownProtectedResource(cfg)` | fn | RFC 9728 protected-resource discovery JSON. |
| `mountStdio(target)` | fn | Connect the server over a stdio transport. |
| `mountHttp(target, opts?)` | fn | Connect over Streamable HTTP (stateless by default). |
| `mountSse(target, path, res)` | fn | Connect over the legacy HTTP+SSE transport. |
| `toToolError(err)` | fn | Normalise any thrown value into `{ isError: true, content: [...] }`. |
| `errorMessage(err)` | fn | Extract a human-readable message from an unknown value. |
| `McpToolError` | class | Typed `Error` subclass with an optional machine-readable `code`. |
| `MCP_CORE_VERSION` | const | Package version marker for diagnostics. |

Types re-exported for consumers: `CreatedServer`, `McpToolDef`, `ShapeInput`, `ToolResult`,
`ToolSuccessResult`, `ToolTextContent`, `ToolErrorResult`, `Clock`, `HttpTransportOptions`,
`OAuthMetadataConfig`, `OAuthAuthorizationServerMetadata`, `ProtectedResourceConfig`,
`OAuthProtectedResourceMetadata`.

## Status

**Implemented:** `RateLimiter` (token bucket, injectable clock), `wellKnownOAuthMetadata`,
`wellKnownProtectedResource`, `toToolError`/`errorMessage`/`McpToolError`, and the
`createServer`/`registerTool` registry helpers — all unit-tested with no live network or transport.

**Stubbed (`// STUB:`):** the SDK seams in `server.ts` (tool callback arg/return widened to
`unknown` so a minor SDK signature drift cannot break compilation) and `transport.ts` (Streamable
HTTP option object restated minimally). The transport mounters call the real SDK at runtime; they
are not unit-tested here (no live transport in tests, per the toolkit testing policy) but compile
against the pinned `@modelcontextprotocol/sdk@^1.12.0`.
