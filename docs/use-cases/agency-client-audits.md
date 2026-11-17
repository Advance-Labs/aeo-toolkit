---
title: Agency client audits
description: >-
  How an agency triages client sites with analyze_website_aeo, runs the full audit, hands fixes to an agent, and tracks whether AI names the client.
sidebar:
  order: 1
---

## Who it is for

An agency or freelancer who audits several client sites for AI search readiness and wants one repeatable routine.

## The job

Find what stops each client's site from being read and quoted by answer engines. Fix the biggest causes first. Then show the client whether AI names them.

## Tools and skills

- `analyze_website_aeo` on the **aeo-research** server. No sign-in. It crawls 10 pages and returns at most the top 8 fixes. It is a shortlist, not the full audit.
- The hosted audit at [advancelabs.dev/tools](https://advancelabs.dev/tools). Free, no account. It runs the 44-check audit and returns a weighted, per-rule report.
- The [`aeo` skill](../../skills/aeo/SKILL.md). It reads an audit, groups the failures, and hands each group to the skill that owns it.
- The AEO Toolkit dashboard, for tracking client questions over time. The [pricing page](https://aeo.advancelabs.dev/pricing) lists what each plan includes.

## Steps

1. Connect aeo-research: `claude mcp add --transport http --scope user aeo-research https://aeo.advancelabs.dev/api/mcp/research/mcp`.
2. For each client, ask your agent to run `analyze_website_aeo` on the client's home page. Note the score, the AI-bot access result and the top fixes.
3. Run the hosted audit on the same URL when you need the full 44-check report. Keep the per-rule result as your baseline.
4. Install the plugin so the agent has the skills: `/plugin install aeo-toolkit --marketplace Advance-Labs/aeo-toolkit`. Ask it to "do AEO on" the client site. The `aeo` skill orders the work and routes each failing rule to its owning skill.
5. Ship the fixes. Re-run `analyze_website_aeo` and the hosted audit after each batch.
6. Add the client's buyer questions to a project in the dashboard. It asks each question of Perplexity, GPT with live web search and Gemini on a schedule, and records whether the client is named.
7. On the Agency plan, the pricing page lists white-label client reports, shareable as a link or a PDF, and prospect workspaces for one-off snapshots when you pitch a new client. Check the page for current limits before you promise a client anything.

## What you get

- A score out of 100 with a grade, and a prioritised fix list per site.
- A list of failing rule IDs, each with one owning skill. Rule definitions are in the [audit rules](../rules/technical-seo.md).
- Over time, whether the client was named for each tracked question, and which competitors were named beside it.

## Limits

- The 8-fix list from `analyze_website_aeo` is a first look. Use the full audit before you quote a score to a client.
- An audit score lists known causes of being skipped or misread. It does not measure whether anyone cites the site. Tracking does that.
- Tracking answers are API answers, not screenshots of the consumer apps.
