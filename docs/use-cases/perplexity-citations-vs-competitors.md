---
title: Perplexity citations vs competitors
description: >-
  How an in-house SEO checks whether Perplexity cites their brand for buyer questions, compared with named competitors, using the aeo-research tools.
sidebar:
  order: 2
---

## Who it is for

An in-house SEO or marketer who wants to know whether Perplexity cites their site for the questions buyers ask, and how that compares with competitors.

## The job

Build a fixed set of buyer prompts. Take a baseline. Compare citation share with competitors. Re-measure after you ship fixes.

## Tools and skills

All on the **aeo-research** server, no sign-in:

- `discover_ranking_prompts` suggests prompts for a topic. It can live-test a few (`testCount`, 0 to 10).
- `get_visibility_report` runs an AEO crawl plus per-prompt citation checks and returns an overall citation rate.
- `check_ai_visibility` checks one prompt against one URL.
- `compare_competitor_visibility` runs one prompt and ranks two or more URLs by whether and where each is cited.

Every one of these queries **Perplexity Sonar only**, with your own Perplexity API key passed on each call. The key is used for that request and is not stored or logged. A result means "cited by Perplexity". It does not speak for any other assistant.

The method is in the [`aeo-visibility-tracking` skill](../../skills/aeo-visibility-tracking/SKILL.md).

## Steps

1. Write 15 to 30 prompts from real customer questions. Add candidates from `discover_ranking_prompts`, then review them. Mix problem, comparison, category and a few branded prompts.
2. Freeze the list and date it. Changing prompts between runs breaks the comparison.
3. Run `get_visibility_report` with your URL, the prompts and your Perplexity key. Record, per prompt, whether you were cited and at what rank.
4. Run the same set once or twice more the same week. The gap between runs is your noise floor.
5. For the prompts that matter, call `compare_competitor_visibility` with your URL and your competitors' URLs. Compare how many prompts each domain is cited for across the set, not a single answer.
6. Fix the site, then re-run the frozen set every week or two. Log each fix with its date.

## What you get

- A citation count with its denominator, for example "cited in 9 of 24 prompts".
- The rank of each citation, and which other domains were cited.
- A competitor table for the prompts you chose.

## Limits

- One call is one sample. Answers vary, so judge a change only against your own noise floor.
- "Cited" means a URL on your host appears in Perplexity's citation list. It does not mean the answer recommends you.
- Report branded and unbranded prompts separately. Branded prompts inflate a blended rate.
- Do not describe these results as ChatGPT, Claude or Gemini visibility. The aeo-toolkit server and the hosted dashboard use a different set of engines, covered in [Buyer questions](../guides/buyer-questions.md#which-ai-engines-does-it-measure).
