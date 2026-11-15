---
title: Install the AEO MCP servers from the MCP Registry
description: >-
  The three AEO MCP servers are listed in the official MCP Registry. What each one does, how to add it to Claude Code, Claude, ChatGPT and Cursor, and how sign-in works for each.
---

The AEO Toolkit runs three hosted MCP servers. They are listed in the official
[MCP Registry](https://registry.modelcontextprotocol.io) under the `dev.advancelabs` namespace
(published 2026-10-31, all three active). There is nothing to install locally: each
server is a Streamable-HTTP endpoint, and you point your client at its URL.

**34 distinct tools in total.** Every tool is read-only (`readOnlyHint: true`, `destructiveHint: false`).

## The servers

> **2026-11-14: two servers.** The registry entries below are unchanged, but behind them there are now
> two servers: `aeo-research` (`/api/mcp/research/mcp`, no sign-in, the visibility and backlink tools)
> and the AEO Toolkit account server, which kept the `aeo-search` URL and now signs in with an AEO
> Toolkit account. The `ai-visibility` and `backlink` URLs stay up as aliases. See the
> [README](../../README.md#connect-the-mcp-servers) for the current setup.

| Registry name | Endpoint | Tools | Sign-in |
|---|---|---|---|
| `dev.advancelabs/aeo-search` | `https://aeo.advancelabs.dev/api/mcp/search/mcp` | 33 | OAuth 2.1 with the AEO Toolkit account |
| `dev.advancelabs/aeo-visibility` | `https://aeo.advancelabs.dev/api/mcp/ai-visibility/mcp` | 5 | None |
| `dev.advancelabs/aeo-backlink` | `https://aeo.advancelabs.dev/api/mcp/backlink/mcp` | 7 | None |

**aeo-search** reads Google Search Console, GA4 and Bing Webmaster data. The full tool list is in
the [tool reference](tools.md#search-server--20-tools).

**aeo-visibility** has five tools: `analyze_website_aeo`, `check_ai_visibility`,
`discover_ranking_prompts`, `get_visibility_report` and `compare_competitor_visibility`.

**aeo-backlink** has seven tools: `find_mentions`, `find_prospects`, `find_competitor_link_sources`,
`verify_page_links`, `extract_contact_info`, `check_page_history` and `generate_outreach_email`.

The trailing `/mcp` on each URL is required.

## Look up the registry entries

```bash
curl "https://registry.modelcontextprotocol.io/v0/servers?search=dev.advancelabs"
```

Each entry carries the endpoint under `remotes` (type `streamable-http`) and `status: active`.

## Claude Code

```bash
claude mcp add --transport http aeo-visibility https://aeo.advancelabs.dev/api/mcp/ai-visibility/mcp
claude mcp add --transport http aeo-backlink   https://aeo.advancelabs.dev/api/mcp/backlink/mcp
claude mcp add --transport http aeo-search     https://aeo.advancelabs.dev/api/mcp/search/mcp
```

Add `--scope user` to register a server for every project instead of the current one. Check the
result with `claude mcp list`.

`aeo-search` needs a sign-in. Run `/mcp` inside Claude Code, select `aeo-search` and choose
**Authenticate**. A browser opens for Google consent, and the token is stored by the client.

## Claude (claude.ai and Claude Desktop)

The servers are not yet in the Claude Connectors Directory. Add each one by URL as a custom
connector: **Settings, Connectors, Add custom connector**, then paste the endpoint URL.

For `aeo-search`, the connector starts the Google sign-in when you connect it. Custom connectors in
claude.ai and Claude Desktop can complete this sign-in (their OAuth callbacks are allowlisted on
the server since 2026-10-31).

## ChatGPT

The servers are not yet in the ChatGPT app directory. In ChatGPT, turn on developer mode, then add
each server by URL as a custom connector. ChatGPT can complete the `aeo-search` Google sign-in
(its OAuth callback is allowlisted since 2026-10-31). The other two servers connect without a
sign-in.

## Cursor and other clients

Any client that accepts a remote MCP URL works. In Cursor, edit `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "aeo-visibility": { "url": "https://aeo.advancelabs.dev/api/mcp/ai-visibility/mcp" },
    "aeo-backlink": { "url": "https://aeo.advancelabs.dev/api/mcp/backlink/mcp" },
    "aeo-search": { "url": "https://aeo.advancelabs.dev/api/mcp/search/mcp" }
  }
}
```

`aeo-search` works only in clients that support MCP OAuth. A client without it receives a 401 and
cannot sign in.

## How authentication works

**aeo-search** (now the AEO Toolkit account server) uses OAuth 2.1. An anonymous request gets a `401`
with a `WWW-Authenticate` header that points the client at the server's discovery metadata. The
client then opens a browser to sign in to AEO Toolkit. Google and Bing come from the connections on
your AEO Toolkit project, and AI provider keys from the account settings. A raw Google token as
`Authorization: Bearer` and a Bing key in `x-bing-api-key` still work for the search tools.

**aeo-visibility** needs no sign-in. The tools backed by Perplexity take your own Perplexity API
key as a tool argument. The key is used for that request only and is never stored or logged.

**aeo-backlink** needs no sign-in. Six of its seven tools take no key; `generate_outreach_email`
takes your own model API key as a tool argument, used for that request only and never stored or logged.

## Compatibility alias

The old path `/api/mcp/ga-gsc/mcp` still reaches the search server, so existing configs keep
working. New configs should use `/api/mcp/search/mcp`.

## See also

- [Connection details for every client](https://aeo.advancelabs.dev/mcp) on the AEO Toolkit site.
- [Where to list your MCP server](https://advancelabs.dev/guides/where-to-list-your-mcp-server):
  how these servers were published to the registry, and what the Claude and ChatGPT directories require.
- [AEO Toolkit](https://advancelabs.dev/lab/aeo-toolkit) by Advance Labs.
