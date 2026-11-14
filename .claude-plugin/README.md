# AEO Toolkit plugin

Answer Engine Optimization for coding agents. This plugin gives Claude Code 24 skills that make a
website reachable, understandable and citable by AI answer engines (ChatGPT, Claude, Perplexity,
Gemini, Google AI Overviews, Copilot). It also connects the three hosted AEO Toolkit MCP servers,
which the skills use to detect problems and verify fixes.

Every one of the 58 rules in the open-source AEO Toolkit audit has exactly one owning skill. Each
skill follows the same loop: **detect** the problem, **decide** whether it really is one, **implement**
the fix with a recipe for your stack (Next.js, Astro, WordPress, static HTML, Shopify, WooCommerce),
then **verify** with the same check. Start with the `aeo` skill, or ask in your own words ("why
isn't ChatGPT citing my site", "add Organization schema", "is GPTBot blocked").

## Install

```
/plugin install aeo-toolkit --marketplace Advance-Labs/aeo-toolkit
```

The search server asks for Google sign-in on first use (`/mcp` → Authenticate). If you previously
added these servers by hand with `claude mcp add`, remove those entries to avoid duplicate tools.

## What it contains

- `skills/`: 24 skills. Markdown instructions and per-stack recipes only. **No scripts, hooks, binaries
  or local commands.** The skills edit files in your project only through Claude Code's normal,
  permissioned editing tools.
- `.claude-plugin/plugin.json`: three remote MCP servers over HTTPS. Nothing runs locally.

## What it sends, and where

All three MCP servers are hosted by Advance Labs at `aeo.advancelabs.dev`. Every tool is **read-only**:
none of them writes to your site or to any third-party account.

| Server | Auth | What a call sends | What it does with it |
|---|---|---|---|
| `visibility` | none | a URL to audit, or a question and a domain | Crawls the URL's public pages to score them. Questions are sent to Perplexity Sonar to see whether the domain is cited. |
| `backlink` | none | a domain, a URL or a topic | Runs web searches and fetches public pages to find mentions, link prospects and contact details published on the target's own site. |
| `search` | Google OAuth (or your own Google token; optional Bing API key) | the Search Console, GA4 or Bing property and the report you ask for | Reads reporting data from Google Search Console, GA4 and Bing Webmaster Tools with read-only scopes. The Google refresh token is stored encrypted; reporting data is fetched on request and not kept in our database. |

The skills themselves send nothing anywhere. Without the MCP servers they fall back to local checks
(`curl`, view-source) described in each skill's **Detect** step.

Privacy policy: https://aeo.advancelabs.dev/privacy. It covers what is stored, providers, retention
and deletion. To revoke Google access, remove the connection in your Google account or ask us to
delete the stored token.

## Source and docs

- Skills source: https://github.com/Advance-Labs/aeo-toolkit/tree/main/skills. This plugin folder is
  generated from it on every push to `main`. Change the skills there, not here.
- Every skill as a readable guide: https://docs.advancelabs.dev/aeo-toolkit/skills/
- Every audit rule and the skill that fixes it: https://docs.advancelabs.dev/aeo-toolkit/rules/aeo/

Apache-2.0. Made by Advance Labs.
