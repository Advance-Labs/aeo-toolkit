---
title: Install the AEO MCP servers from the MCP Registry
description: >-
  The two AEO MCP servers are listed in the official MCP Registry. What each one does, how to add it to Claude Code, Claude, ChatGPT and Cursor, and how sign-in works for each.
---

The AEO Toolkit runs two hosted MCP servers. They are listed in the official
[MCP Registry](https://registry.modelcontextprotocol.io) under the `dev.advancelabs` namespace.
There is nothing to install locally: each server is a Streamable-HTTP endpoint, and you point your
client at its URL.

**aeo-research has 12 tools and AEO Toolkit has 37 (38 distinct).** No tool edits your site. Every
research tool is read-only. Five AEO Toolkit tools act on your account and are annotated
`readOnlyHint: false`: three visibility tools save to your dashboard, and `submit_indexnow` and
`submit_to_bing` submit URLs.

## The servers

| Registry name | Endpoint | Tools | Sign-in |
|---|---|---|---|
| `dev.advancelabs/aeo-research` | `https://aeo.advancelabs.dev/api/mcp/research/mcp` | 12 | None |
| `dev.advancelabs/aeo-search` (title "AEO Toolkit") | `https://aeo.advancelabs.dev/api/mcp/search/mcp` | 37 | OAuth 2.1 with the AEO Toolkit account |

**aeo-research** has the five visibility tools (`analyze_website_aeo`, `check_ai_visibility`,
`discover_ranking_prompts`, `get_visibility_report`, `compare_competitor_visibility`) and the seven
backlink tools (`find_mentions`, `find_prospects`, `find_competitor_link_sources`,
`verify_page_links`, `extract_contact_info`, `check_page_history`, `generate_outreach_email`). Its
visibility tools query Perplexity with your own Perplexity key.

**AEO Toolkit** adds Google Search Console, GA4 and Bing Webmaster data, saved visibility checks on
your workspace's engines, keyword volumes, indexing tools and the same backlink tools. The full
list is in the [tool reference](tools.md).

The registry still shows `dev.advancelabs/aeo-visibility` and `dev.advancelabs/aeo-backlink`. They
are the two servers the research server replaced on 2026-11-14, kept as aliases and marked as
moved. Use `aeo-research` for new setups.

The trailing `/mcp` on each URL is required.

## Look up the registry entries

```bash
curl "https://registry.modelcontextprotocol.io/v0/servers?search=dev.advancelabs"
```

Each entry carries the endpoint under `remotes` (type `streamable-http`) and `status: active`.

## Claude Code

```bash
claude mcp add --transport http aeo-research https://aeo.advancelabs.dev/api/mcp/research/mcp
claude mcp add --transport http aeo-toolkit  https://aeo.advancelabs.dev/api/mcp/search/mcp
```

Add `--scope user` to register a server for every project instead of the current one. Check the
result with `claude mcp list`.

`aeo-toolkit` needs a sign-in. Run `/mcp` inside Claude Code, select `aeo-toolkit` and choose
**Authenticate**. A browser opens to sign in to AEO Toolkit, and the token is stored by the client.

## Claude (claude.ai and Claude Desktop)

The servers are not yet in the Claude Connectors Directory. Add each one by URL as a custom
connector: **Settings, Connectors, Add custom connector**, then paste the endpoint URL.

For `aeo-toolkit`, the connector starts the AEO Toolkit sign-in when you connect it. Custom connectors in
claude.ai and Claude Desktop can complete this sign-in (their OAuth callbacks are allowlisted on
the server since 2026-10-31).

## ChatGPT

The servers are not yet in the ChatGPT app directory. In ChatGPT, turn on developer mode, then add
each server by URL as a custom connector. ChatGPT can complete the `aeo-toolkit` sign-in
(its OAuth callback is allowlisted since 2026-10-31). `aeo-research` connects without a sign-in.

## Cursor and other clients

Any client that accepts a remote MCP URL works. In Cursor, edit `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "aeo-research": { "url": "https://aeo.advancelabs.dev/api/mcp/research/mcp" },
    "aeo-toolkit": { "url": "https://aeo.advancelabs.dev/api/mcp/search/mcp" }
  }
}
```

`aeo-toolkit` works only in clients that support MCP OAuth. A client without it receives a 401 and
cannot sign in.

## How authentication works

**aeo-toolkit** (registry name `aeo-search`) uses OAuth 2.1. An anonymous request gets a `401`
with a `WWW-Authenticate` header that points the client at the server's discovery metadata. The
client then opens a browser to sign in to AEO Toolkit. Google and Bing come from the connections on
your AEO Toolkit project, and AI provider keys from the account settings. A raw Google token as
`Authorization: Bearer` and a Bing key in `x-bing-api-key` still work for the search tools.

**aeo-research** needs no sign-in. The visibility tools take your own Perplexity API key as a
tool argument. Six of the seven backlink tools take no key; `generate_outreach_email` takes your
own model API key. Keys are used for that request only and are never stored or logged.

## Compatibility alias

The old paths `/api/mcp/ga-gsc/mcp` and `/api/mcp/toolkit/mcp` still reach the AEO Toolkit
server, and `/api/mcp/ai-visibility/mcp` and `/api/mcp/backlink/mcp` still serve their own tools,
so existing configs keep working. New configs should use the two URLs above.

## See also

- [Connection details for every client](https://aeo.advancelabs.dev/mcp) on the AEO Toolkit site.
- [Where to list your MCP server](https://advancelabs.dev/guides/where-to-list-your-mcp-server):
  how these servers were published to the registry, and what the Claude and ChatGPT directories require.
- [AEO Toolkit](https://advancelabs.dev/lab/aeo-toolkit) by Advance Labs.
