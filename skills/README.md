# AEO Toolkit skills

Claude Skills that give an agent the full method for Answer Engine Optimization: how to make a site
reachable, understandable and citable by ChatGPT, Claude, Perplexity, Gemini, Google AI Overviews
and Copilot, implemented in the stack the agent is actually working in.

The MCP servers answer **"what is wrong, and how is it performing?"** These skills answer **"how
do I fix it here, and how do I know it worked?"** Each one follows the same loop: **detect** with
a rule or tool, **decide** whether it is really a problem, **implement** with per-stack recipes,
then **verify** with the same check.

Start with [`aeo`](aeo/SKILL.md). It reads an audit, orders the work and hands each failing rule
to its owner.

## Every audit rule has an owner

The scoring engine has 58 rules. [`rule-map.json`](rule-map.json) assigns each one to exactly one
skill, and a test in `packages/scoring` fails CI if any of these drift:
- a rule exists without an owning skill
- a mapped skill does not exist
- the router's copy of the map diverges

## The skills

| Skill | Fixes | Uses |
|---|---|---|
| [`aeo`](aeo/SKILL.md) | Router: audit → triage → hand off | `analyze_website_aeo` |
| **Access** | | |
| [`aeo-ai-crawler-access`](aeo-ai-crawler-access/SKILL.md) | AI bots blocked by robots.txt or a CDN; training vs search bots | `analyze_website_aeo` |
| [`aeo-server-rendering`](aeo-server-rendering/SKILL.md) | Content that only exists after JavaScript runs | `analyze_website_aeo` |
| [`aeo-llms-txt`](aeo-llms-txt/SKILL.md) | llms.txt, served without cannibalizing your pages | `analyze_website_aeo` |
| [`aeo-indexability`](aeo-indexability/SKILL.md) | Sitemaps, canonicals, noindex, redirects, hreflang, HTTPS | `gsc_url_inspect`, `engine_divergence` |
| **Identity** | | |
| [`aeo-organization-entity`](aeo-organization-entity/SKILL.md) | Organization JSON-LD, `@id` graph, consistent identity | `analyze_website_aeo` |
| [`aeo-article-author-schema`](aeo-article-author-schema/SKILL.md) | Article + Person author markup | `analyze_website_aeo` |
| [`aeo-faq-qa-schema`](aeo-faq-qa-schema/SKILL.md) | FAQPage / QAPage / HowTo, honestly scoped | `analyze_website_aeo` |
| [`aeo-structured-data-validation`](aeo-structured-data-validation/SKILL.md) | Invalid or conflicting structured data | `analyze_website_aeo` |
| [`aeo-product-schema`](aeo-product-schema/SKILL.md) | Product / Offer / Review for stores | `analyze_website_aeo` |
| [`aeo-local-business-schema`](aeo-local-business-schema/SKILL.md) | LocalBusiness, NAP consistency, Business Profile | `check_ai_visibility` |
| **Extractability** | | |
| [`aeo-answer-first-content`](aeo-answer-first-content/SKILL.md) | Question headings, answer-first paragraphs, depth | `discover_ranking_prompts` |
| [`aeo-site-structure`](aeo-site-structure/SKILL.md) | Breadcrumbs and internal linking | `analyze_website_aeo` |
| [`aeo-page-metadata`](aeo-page-metadata/SKILL.md) | Titles, descriptions, Open Graph, lang, viewport, alt text | `gsc_ctr_gaps` |
| [`aeo-content-freshness`](aeo-content-freshness/SKILL.md) | Honest dates across page, JSON-LD and sitemap | `gsc_decay` |
| [`aeo-eeat-trust-signals`](aeo-eeat-trust-signals/SKILL.md) | About, contact, policies, references | `analyze_website_aeo` |
| **Off-site** | | |
| [`aeo-citation-earning`](aeo-citation-earning/SKILL.md) | Where competitors get cited, mentions, outreach | backlink tools |
| **Measurement** | | |
| [`aeo-visibility-tracking`](aeo-visibility-tracking/SKILL.md) | Prompt sets, baselines, Perplexity citation share | visibility tools |
| [`aeo-ai-referral-analytics`](aeo-ai-referral-analytics/SKILL.md) | AI-assistant referral traffic in GA4 | `ga4_run_report` |
| [`seo-bing-coverage`](seo-bing-coverage/SKILL.md) | Google vs Bing gaps | `engine_divergence`, `bing_*` |
| [`seo-traffic-drop`](seo-traffic-drop/SKILL.md) | Traffic dropped. What caused it? | `gsc_traffic_drop` |
| [`seo-cannibalization`](seo-cannibalization/SKILL.md) | Are my own pages competing? | `gsc_cannibalization` |
| [`seo-content-decay`](seo-content-decay/SKILL.md) | What content needs refreshing? | `gsc_decay` |
| [`seo-high-intent-ctr`](seo-high-intent-ctr/SKILL.md) | Buyer-intent searches that rank but lose the click | `gsc_ctr_gaps` |

Implementation recipes live in each skill's `references/` (Next.js, Astro, WordPress, static HTML,
and Shopify/WooCommerce where relevant). The agent only loads the one for the stack in front of
it.

## Install

Skills are plain directories. Copy the ones you want into your skills folder:

```bash
# Claude Code, for one project
mkdir -p .claude/skills
cp -r path/to/aeo-toolkit/skills/aeo* .claude/skills/

# or for every project
cp -r path/to/aeo-toolkit/skills/* ~/.claude/skills/
```

They activate on their own when a request matches the `description` in the frontmatter. You
do not need to name the skill.

## MCP servers: helpful, mostly optional

The `aeo-*` skills work without any MCP server. Each **Detect** step has a no-MCP fallback, for
example `curl` or view-source. Connecting the servers makes detection and verification faster
and more complete. The `seo-*` and measurement skills read Search Console, GA4, Bing or
Perplexity data, and they need the matching server.

| Server | Endpoint | Auth |
|---|---|---|
| `aeo-visibility` | `https://aeo.advancelabs.dev/api/mcp/ai-visibility/mcp` | none |
| `aeo-backlink` | `https://aeo.advancelabs.dev/api/mcp/backlink/mcp` | none |
| `aeo-search` | `https://aeo.advancelabs.dev/api/mcp/search/mcp` | Google sign-in; Bing key optional |

Setup for each client is at [advancelabs.dev/mcp](https://advancelabs.dev/mcp).

> **On "no API keys" claims.** Search Console requires OAuth. Anything promising GSC data with
> no authentication is either reading an already-authenticated local session or not reading
> Search Console at all.

## What these will not do

- **They don't promise citations.** A fix removes a known blocker. Whether an engine then cites
  you is measured, not assumed.
- **The visibility tools see one engine.** `check_ai_visibility` and its siblings query
  Perplexity, so their readings are Perplexity citations, not "AI" in general.
- **They can't see competitors' Search Console data.** Competitor comparisons use public
  signals (citations, links) only.
- **They don't change anything remotely.** Every MCP tool is read-only. Code changes happen in
  your repo, where you can review them.

## Contributing a skill

Same bar as the rest of the repo:
- encode judgement a tool description cannot hold
- be explicit about what the data cannot answer
- never assert a cause you can't evidence
- date every volatile fact (bot names, Google policies) in a `## Sources` section, against a
  primary source

The frontmatter `description` decides whether the skill activates, so write it as *when to use
this* (including the phrase "Use when"), not as a title.

Two tests keep the skills honest:
- `packages/scoring/src/skills-map.test.ts` here checks rule ownership.
- A test in the private platform repo checks frontmatter, and checks that every MCP tool a skill
  names is registered on one of the three servers.
