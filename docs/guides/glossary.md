---
title: Glossary
description: >-
  Plain definitions of the AEO terms used across these docs, with links to the longer guides on advancelabs.dev.
sidebar:
  order: 5
---

Short definitions, in alphabetical order. Where a longer guide exists, the term links to it instead of repeating it.

## A

**AEO (answer engine optimization).** Making a site easy for AI assistants and answer engines to read, quote and cite. See [Does my business need AEO or SEO](https://advancelabs.dev/guides/does-my-business-need-aeo-or-seo).

**AI crawler.** A bot an AI company runs to fetch pages. Some collect training data. Others fetch pages to answer a question, such as `OAI-SearchBot` and `PerplexityBot`. Blocking the second kind removes you from answers. See [robots.txt for AI crawlers](https://advancelabs.dev/guides/robots-txt-for-ai-crawlers).

**AI referral traffic.** Visits that arrive from an AI assistant. It is always an undercount, because some assistants send no referrer. See [AI referral traffic in GA4](https://advancelabs.dev/guides/ai-referral-traffic-ga4) and the [use case](../use-cases/ai-referral-traffic-ga4.md).

**Answer-first content.** A page where the answer comes directly under a question heading, so an engine can lift it cleanly. See [Write content AI assistants can quote](https://advancelabs.dev/guides/write-content-ai-assistants-can-quote).

## B

**Backlink.** A link from another site to yours. See [AEO link building](https://advancelabs.dev/guides/aeo-link-building) and the [prospecting use case](../use-cases/backlink-citation-prospecting.md).

**Bing Webmaster.** Bing's search console. Google and Bing coverage can differ. See [Bing index coverage](https://advancelabs.dev/guides/bing-index-coverage-for-ai-search).

## C

**Cannibalization.** Two of your pages competing for the same query and splitting clicks. See [Keyword cannibalization](https://advancelabs.dev/guides/keyword-cannibalization).

**Citation.** An answer engine naming or linking your site as a source.

**Content decay.** A page slowly losing traffic over time. See [Content decay](https://advancelabs.dev/guides/content-decay).

## E

**E-E-A-T.** Experience, Expertise, Authoritativeness and Trust. The toolkit's separate scan checks 14 signals for it. It does not change the 44-check audit score. See [E-E-A-T checker](https://advancelabs.dev/guides/eeat-checker).

**Engine check.** One question asked of one AI engine. Plan allowances are counted in engine checks. See [Dashboard tour](dashboard-tour.md).

## G

**GA4.** Google Analytics 4. The `ga4_run_report` tool reads it.

**GSC.** Google Search Console. The `gsc_` tools read it.

## I

**IndexNow.** A protocol for telling participating search engines that a URL changed. `submit_indexnow` sends the notice. See [Pages not indexed by Google or Bing](https://advancelabs.dev/guides/pages-not-indexed-by-google-or-bing).

## J

**JSON-LD.** The format most sites use to publish structured data. See [How to validate structured data](https://advancelabs.dev/guides/how-to-validate-structured-data).

## L

**llms.txt.** A plain-text file at the site root that lists the pages you most want a language model to read. See [How to write an llms.txt file](https://advancelabs.dev/guides/how-to-write-llms-txt-file).

## M

**MCP (Model Context Protocol).** The standard that lets an AI client call tools on a server. AEO Toolkit runs two. See [Troubleshooting MCP connections](troubleshooting-mcp.md).

## O

**Organization schema.** JSON-LD that says who is behind a site. See [Organization schema for AI search](https://advancelabs.dev/guides/organization-schema-for-ai-search).

## R

**Rule.** One of the 44 audit checks. Each has an ID such as `tech.robots-present` and a weight from 2 to 9. See [Reading your audit report](reading-your-audit-report.md).

## S

**Server-side rendering.** Putting the page's real content in the HTML the server sends, not building it with JavaScript afterward. See [Can AI crawlers read JavaScript](https://advancelabs.dev/guides/can-ai-crawlers-read-javascript).

**Skill.** A set of instructions that tells an AI agent how to fix one kind of problem. The plugin ships 24. See [AEO skills for AI coding agents](https://advancelabs.dev/guides/aeo-skills-for-ai-coding-agents).

**Structured data.** Machine-readable facts about a page, usually JSON-LD. See [Article and author schema](https://advancelabs.dev/guides/article-author-schema).

## V

**Visibility tracking.** Asking buyer questions of AI engines on a schedule and recording whether you are named. See [Measure AI search visibility](https://advancelabs.dev/guides/measure-ai-search-visibility) and [Visibility tracking](../VISIBILITY-TRACKING.md).
