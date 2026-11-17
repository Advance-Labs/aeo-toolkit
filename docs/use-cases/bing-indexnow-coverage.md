---
title: Bing and IndexNow coverage
description: >-
  Check whether Bing crawls and indexes a site, compare it with Google, and submit new URLs through IndexNow or Bing Webmaster, using the aeo-toolkit server.
sidebar:
  order: 7
---

## Who it is for

A site owner or SEO whose traffic differs between Google and Bing, or who wants new pages seen quickly by Bing and the other IndexNow engines.

## The job

Find out whether a gap is on Google, on Bing or on both. Check Bing crawl health. Submit changed URLs.

## Tools and skills

On the **aeo-toolkit** server. Sign in with your AEO Toolkit account. You need Google connected and a Bing Webmaster key saved on the project.

- `list_gsc_sites` and `list_bing_sites` show which properties exist.
- `bing_index_health` returns crawl stats, crawl issues and the URL-submission quota.
- `compare_engines` merges query rows from both engines.
- `engine_divergence` classifies each query as `google_specific`, `bing_specific`, `broad` or `insufficient_data`.
- `bing_keyword_research` returns demand around a seed phrase. Search Console has no equivalent.
- `indexing_status` shows whether the IndexNow key file is live, whether Bing is connected and the latest submission runs.
- `submit_indexnow` and `submit_to_bing` submit a sitemap or explicit URLs.
- `gsc_url_inspect` checks one URL's Google status.

The method is in the [`seo-bing-coverage` skill](../../skills/seo-bing-coverage/SKILL.md). For the indexing rules, see [`aeo-indexability`](../../skills/aeo-indexability/SKILL.md).

## Steps

1. Call `list_gsc_sites` and `list_bing_sites`. If the site is not in Bing Webmaster, stop. That is the finding. The owner must verify it there.
2. Call `bing_index_health` first. Read crawled and in-index counts and any crawl issues before you ask ranking questions.
3. Call `compare_engines` to see which queries exist on one engine and not the other. Bing rows are an unwindowed aggregate, so do not compare click counts.
4. Call `engine_divergence` over at least a few weeks. Read the classes:
   - `google_specific`: held on Bing, dropped on Google
   - `bing_specific`: held on Google, dropped on Bing
   - `broad`: dropped on both
5. For new or changed pages, call `indexing_status`. If the key file is live, call `submit_indexnow`. If Bing is connected, `submit_to_bing` uses your saved Bing key.
6. Check a few URLs on Google with `gsc_url_inspect`. These submit tools cannot reach Google.

## What you get

A classification per query, a crawl and index health read for Bing, and a logged submission run in the dashboard for every submit.

## Limits

- `submit_indexnow` and `submit_to_bing` are the two tools that act on an outside service. Each takes up to 100 explicit URLs on your own host, with one submission per site every 5 minutes. IndexNow covers Bing, Yandex, Naver and Seznam. Submission is a notification, not a promise of indexing.
- `insufficient_data` is the normal answer for small sites and long-tail queries. It is not a clean bill of health.
- Bing's page-level `isPageIndexed` field is always false here, so do not report "not indexed" from it.
- Whether ChatGPT search or Copilot use Bing's index is reported by secondary sources only. Keep Bingbot and OAI-SearchBot allowed either way.
