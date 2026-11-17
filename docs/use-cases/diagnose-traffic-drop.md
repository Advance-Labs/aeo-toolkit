---
title: Diagnose a traffic drop
description: >-
  Find which pages lost clicks, and whether the cause is lost rankings, lost demand or a changed results page, using Search Console data from Claude.
sidebar:
  order: 3
---

## Who it is for

An SEO, site owner or developer whose organic clicks fell and who needs a specific, evidenced answer.

## The job

Name the pages that lost the clicks. Say whether the loss is a few pages or the whole site. Separate lost rankings from lost demand.

![The diagnosis flow: confirm the property and two equal periods, run gsc_traffic_drop by page, split on a few pages versus the whole site, compare impressions with position to tell lost rankings from less demand from a changed results page, then inspect the worst pages.](../assets/diagram-traffic-drop-flow.svg)

## Tools and skills

On the **aeo-toolkit** server. Sign in with your AEO Toolkit account. Connect Google on your project first.

- `list_gsc_sites` lists your Search Console properties.
- `gsc_traffic_drop` attributes the change between two periods by page or by query.
- `compare_periods` compares two ranges.
- `gsc_decay` finds pages slowly losing traffic.
- `gsc_url_inspect` checks Google's index status for up to 25 URLs per call. It is read-only.
- `list_ga4_properties` and `ga4_run_report` let you check whether analytics agrees.

The method is in the [`seo-traffic-drop` skill](../../skills/seo-traffic-drop/SKILL.md). Related skills: [`seo-content-decay`](../../skills/seo-content-decay/SKILL.md) and [`seo-cannibalization`](../../skills/seo-cannibalization/SKILL.md).

## Steps

1. Call `list_gsc_sites` and confirm the property. `https://example.com/` and `sc-domain:example.com` are different properties.
2. Pick two equal-length periods that align on weekdays. Comparing 30 days to 28 manufactures a drop.
3. Run `gsc_traffic_drop` with `dimension: 'page'`. Read the clicks lost and gained before the list.
4. Look at each page's share of the decline. A few pages carrying most of it points at those pages. A thin spread points at the whole site.
5. For the top pages, compare the change in impressions with the change in position:
   - impressions down and position worse: lost rankings
   - impressions down and position flat: less demand, or a changed results page
   - impressions flat, clicks down: something on the results page is absorbing clicks
6. Re-run with `dimension: 'query'` for the affected pages. One topic means a content or intent problem. Scattered queries suggest a technical or site-wide cause.
7. Run `gsc_url_inspect` on the worst pages to rule out an index problem.
8. Ask what changed on your side: a release, a migration, a robots.txt edit.

## What you get

A statement like "Clicks fell 2,400 between the two periods. Four pages account for 78% of that. All four lost rank, and impressions fell with them." Then a next step per group of pages.

## Limits

Search Console shows what happened, not why. It does not know about your deploys, your competitors or algorithm updates. State a cause only when the numbers and a known event line up, and call it a hypothesis.
