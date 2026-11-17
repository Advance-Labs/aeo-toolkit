---
title: Troubleshooting MCP connections
description: >-
  Fixes for the usual MCP problems: a missing trailing /mcp, a 401 sign-in error, duplicate plugin tools and a server that connects with no tools.
sidebar:
  order: 4
---

Both servers are hosted, so almost every problem is the URL, the sign-in or a doubled registration. Work through the checks in this order.

![The two MCP servers. aeo-research has 12 tools, needs no sign-in and reaches Perplexity with your own key. aeo-toolkit has 37 tools, needs an AEO Toolkit account and reaches Search Console, GA4, Bing, the workspace engines and the IndexNow and Bing submission endpoints.](../assets/diagram-mcp-servers.svg)

## The URL must end in /mcp

| Server | Endpoint |
|---|---|
| aeo-research | `https://aeo.advancelabs.dev/api/mcp/research/mcp` |
| aeo-toolkit | `https://aeo.advancelabs.dev/api/mcp/search/mcp` |

The trailing `/mcp` is part of the endpoint. A URL that stops at `/api/mcp/research` or `/api/mcp/search` does not connect. The aeo-toolkit endpoint keeps `search` in its path because it kept the original URL. The name changed and the path did not.

Check what your client has:

```bash
claude mcp list
```

If an entry has the wrong URL, remove it and add it again:

```bash
claude mcp remove aeo-toolkit
claude mcp add --transport http --scope user aeo-toolkit https://aeo.advancelabs.dev/api/mcp/search/mcp
```

## 401 or "needs authentication" on aeo-toolkit

This is expected on a first connection. The aeo-toolkit server answers an anonymous request with a 401 that points your client at the AEO Toolkit sign-in. The client then opens a browser.

In Claude Code:

1. Run `/mcp`.
2. Select **aeo-toolkit**.
3. Choose **Authenticate** and sign in with your AEO Toolkit account.

If the 401 stays after you sign in:

- **Your client may not support MCP sign-in.** aeo-toolkit works only in clients that do. A client without it cannot use the server. Use **aeo-research** there, which needs no sign-in.
- **The sign-in may have lapsed.** Run `/mcp` and choose **Authenticate** again.
- **You may be signed in to the wrong account.** The tools use the workspace and the Google, Bing and AI keys saved on that account.

The root `/.well-known/oauth-*` documents return 404 on purpose. They are scoped to the aeo-toolkit path, so the keyless aeo-research server is never pulled into a login. A 404 on the root path is not a fault.

## Duplicate tools after installing the plugin

The plugin registers its own copies of both servers. If you also added them by hand, your client lists every tool twice, once from each registration.

Remove the hand-added ones and keep the plugin's:

```bash
claude mcp remove aeo-research
claude mcp remove aeo-toolkit
```

Then restart the session and run `claude mcp list`. If you want the servers without the skills, do the reverse: uninstall the plugin and keep the manual entries. Pick one route.

## The server connects but a tool fails

- **Google tools return no sites.** Connect Google on your AEO Toolkit project first. `list_gsc_sites` should then return your properties. `https://example.com/` and `sc-domain:example.com` are different properties.
- **Bing tools fail.** They need a Bing Webmaster key saved on the project.
- **Visibility tools stop or refuse.** On aeo-toolkit these run on the workspace's engines and use quota. Plan allowances are on the [pricing page](https://aeo.advancelabs.dev/pricing). On aeo-research they use your own Perplexity key, so check that the key is valid.
- **A tool looks missing.** aeo-research has 12 tools and aeo-toolkit has 37. If you see far fewer, the server did not finish connecting. Restart the client.

Two aeo-toolkit tools act on services and are worth knowing about: `submit_indexnow` and `submit_to_bing` send URLs for indexing. The others read.

## Still stuck

Check that the endpoint answers at all:

```bash
curl -i https://aeo.advancelabs.dev/api/mcp/search/mcp
```

A `401` with a `WWW-Authenticate` header means the server is up and wants a sign-in. Then see [Where to find and install AEO Toolkit](where-to-find-and-install.md) for the install line for each client, or open an issue on [GitHub](https://github.com/Advance-Labs/aeo-toolkit/issues).
