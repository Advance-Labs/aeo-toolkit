# AEO Toolkit plugin

Answer Engine Optimization for coding agents. This plugin gives Claude Code 24 skills that make a
website reachable, understandable and citable by AI answer engines (ChatGPT, Claude, Perplexity,
Gemini, Google AI Overviews, Copilot). It also connects the two hosted AEO Toolkit MCP servers,
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

The `toolkit` server asks you to sign in to your AEO Toolkit account on first use (`/mcp` → Authenticate). Connect Google and Bing on your project in the AEO Toolkit dashboard, and save AI provider keys under Settings; the server uses them, so you never paste a key into chat. If you previously
added these servers by hand with `claude mcp add`, remove those entries to avoid duplicate tools.

## What it contains

- `skills/`: 24 skills. Markdown instructions and per-stack recipes only. **No scripts, hooks, binaries
  or local commands.** The skills edit files in your project only through Claude Code's normal,
  permissioned editing tools.
- `.claude-plugin/plugin.json`: two remote MCP servers over HTTPS. Nothing runs locally.

## What it sends, and where

Both MCP servers are hosted by Advance Labs at `aeo.advancelabs.dev`. Every tool is **read-only**:
none of them writes to your site or to any third-party account.

| Server | Auth | What a call sends | What it does with it |
|---|---|---|---|
| `research` | none | a URL to audit, a question and a domain, or a domain, URL or topic to research | Crawls the URL's public pages to score them. Questions are sent to Perplexity Sonar, with **your own** Perplexity key, to see whether the domain is cited. Backlink research searches the web (Brave Search) and the Common Crawl index, fetches public pages to find mentions, link prospects and contact details published on the target's own site, and reads page history from the Internet Archive's Wayback Machine. `generate_outreach_email` sends the draft request to the model provider **you** choose with **your own** API key. Keys are used for that request only and never stored or logged. |
| `toolkit` | AEO Toolkit account (OAuth) | the Search Console, GA4 or Bing property and the report you ask for; visibility prompts and a domain; backlink research targets | Reads reporting data from Google Search Console, GA4 and Bing Webmaster Tools with read-only scopes, using the Google connection and Bing key on your AEO Toolkit project. Visibility checks run against the AI engines the dashboard uses and are saved to your workspace. Backlink tools work as on `research`; `generate_outreach_email` uses the AI provider key saved in your account. Google tokens, Bing keys and AI provider keys are stored encrypted in your account; reporting data is fetched on request and not kept in our database. |

The skills themselves send nothing anywhere. Without the MCP servers they fall back to local checks
(`curl`, view-source) described in each skill's **Detect** step.

Privacy policy: https://aeo.advancelabs.dev/privacy. It covers what is stored, providers, retention
and deletion. To revoke Google access, remove the connection in your Google account or ask us to
delete the stored token.

## Source and docs

- Skills source: https://github.com/Advance-Labs/aeo-toolkit/tree/main/skills. This plugin folder is
  generated from it on every push to `main`. Change the skills there, not here.
- Every skill as a readable guide: https://advancelabs.dev/docs/aeo-toolkit/skills
- Every audit rule and the skill that fixes it: https://advancelabs.dev/docs/aeo-toolkit/rules/aeo

Apache-2.0. Made by Advance Labs.
