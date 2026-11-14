---
name: aeo-citation-earning
description: Earn the off-site mentions and links that make a site more likely to be cited by AI answer engines - find where competitors are cited or linked, turn unlinked brand mentions into links, prospect relevant sites, draft honest outreach, and confirm links went live. Use when someone asks about "backlinks", "link building", "who links to my competitor", "unlinked mentions", "guest post prospects", "digital PR", "how do I get cited by ChatGPT or Perplexity", or "did my link go live". Uses the aeo-backlink MCP server (find_prospects, find_mentions, extract_contact_info, check_page_history, generate_outreach_email, verify_page_links, find_competitor_link_sources) and aeo-visibility (check_ai_visibility, compare_competitor_visibility).
---

# Earning citations and links off-site

Answer engines cite pages from many sites, not just yours. Being mentioned and linked by
credible third parties is slow, human work. These tools find the opportunities and check results;
they cannot buy the outcome, and you should not promise one.

I could not verify a published study of which sources each answer engine prefers, so this skill
makes no claims about that. Measure it for the user's own topic: see "Find where rivals are
cited".

## When this matters / when it doesn't

Matters when the site is technically fine (crawlable, rendered, clear content) and still not
cited, or when competitors are cited and the user is not.

Does not matter yet, and you should say so, when the site fails basics: blocked AI crawlers,
client-rendered content, no entity or about page. Fix those first with the owning skills. Off-site
effort on a site engines cannot read is wasted.

Be careful with the budget too. The hosted backlink server charges daily search units to the
caller (at the time of reading its source: `find_mentions` 1, `find_competitor_link_sources` 2,
`find_prospects` 4, with a default of 10 units per caller per day and 150 overall; operators can
change these). `find_prospects` can therefore run about twice a day. Spend units on the best
targets, and tell the user when a call returns the budget message ("try search again tomorrow").
`extract_contact_info`, `verify_page_links`, `check_page_history` and `generate_outreach_email` do
not use the search budget.

## Detect and plan

**1. Baseline.** Choose 5 to 10 prompts a customer would type. Run `check_ai_visibility` for each
(prompt plus the site URL, plus a Perplexity API key). It reports whether the URL is cited and its
rank. Note it uses **Perplexity Sonar only**, so it says nothing about ChatGPT or Gemini. One run
is one sample; answers vary, so run each prompt a few times on different days and record a rate.
`discover_ranking_prompts` can suggest prompts for a topic.

**2. Find where rivals are cited.** `compare_competitor_visibility` takes one prompt and 2 or
more URLs and ranks who is cited. For rivals that are cited, call `find_competitor_link_sources`
with the competitor URL. Be clear about its limits: it approximates linking pages from free web
search and brand mentions; it is "not a complete backlink index" and excludes the rival's own
domain. Treat the list as leads to read, not a full link profile.

**3. Find your own unlinked mentions.** `find_mentions` with `brand` and `domain` splits results
into linked and unlinked. Unlinked third-party mentions are the easiest ask: the site already
knows you. Check each page yourself; search snippets can be wrong, and a mention may be negative
or a different company with the same name.

**4. Prospect.** `find_prospects` with a topic runs write-for-us, guest-post, resource-page and
roundup searches and merges them by host. Read what comes back. Many "write for us" pages are
link farms. Use `check_page_history` (Wayback snapshots) to see how long a site has existed and
whether it looks like an established publication.

## Decide

Keep a prospect only if all hold:
- The site is relevant to your topic and its readers would plausibly want your page.
- It looks like a real publication or resource, not a link farm.
- You have something worth linking to (original data, a guide, a tool, a product that fits).
- You can say honestly why they should care.

Skip, do not "work around", sites that sell links, guest-post farms and anything you would be
embarrassed to name.

## Implement: outreach

1. `extract_contact_info` takes a page URL and returns emails and social handles found on that
   page. **Only run it on the target's own site** (their contact, about or team page), and only
   contact people there for a reason related to their content. Do not scrape emails from third-party
   lists or directories. Record where and when you found each contact and why they are relevant.
   Respect applicable anti-spam law (for example Canada's CASL, CAN-SPAM, GDPR): identify yourself,
   give a real way to opt out, and stop when asked.
2. `generate_outreach_email` drafts a short email from contact and context (`fromBrand`, `reason`,
   `targetUrl`, `notes`). It needs the user's own LLM provider, model and API key, which are
   request-scoped. Never paste a key you were not given. Always edit the draft: add the specific
   thing you liked on their page, remove flattery, and keep it short. Do not send the draft
   unreviewed, and do not send bulk identical emails.
3. Offer value, not payment for links. Examples: a correction for a broken or outdated link, an
   original statistic, a useful resource that fits their list.
4. **Paid links.** Google's spam policies treat buying or selling links for ranking purposes as
   link spam, but it is "not a violation... as long as they are qualified with a rel="nofollow" or
   rel="sponsored" attribute". So: no undisclosed paid placement, no free-product-for-link swaps
   without the same qualification, no link exchanges at scale, no optimised-anchor guest posts or
   press-release link campaigns. If money or product changes hands, require `rel="sponsored"`.

## Verify

1. When a placement is reported live, call `verify_page_links` with the page URL and your target
   domain. It reports whether a link exists, anchor text, and rel values (`nofollow`,
   `sponsored`, `ugc`), and whether it is dofollow. Confirm it is the link you agreed, and that a
   sponsored link is marked as such.
2. Re-check later (weeks). Links get removed or changed; `check_page_history` can show past
   versions of the page.
3. **Measure impact without overclaiming.** Re-run the baseline prompts with `check_ai_visibility`
   after engines have had time to re-crawl. Report the before and after citation rates, the number
   of runs, and the caveats (Perplexity only, sampling noise, other changes made in the meantime).
   A rise is consistent with the work helping; it is not proof.

## Pitfalls

- Promising "ChatGPT will cite you after N links". Nobody can evidence that.
- Treating `find_competitor_link_sources` output as the rival's full backlink profile.
- Mass-emailing scraped addresses. This is spam, and may be illegal.
- Paying for links with no `rel="sponsored"`.
- Chasing every guest-post farm because `find_prospects` returned it.
- Burning the daily search budget on broad queries before choosing targets.
- Counting a nofollow or sponsored link as worthless: it can still send readers and mentions.
  Just do not misreport it as passing ranking credit.
- Pasting API keys into chat logs or committing them.

## Sources

- Google spam policies, link spam: https://developers.google.com/search/docs/essentials/spam-policies (verified 2026-11-13)
- Google, Qualify outbound links: https://developers.google.com/search/docs/crawling-indexing/qualify-outbound-links (verified 2026-11-13)
- Tool contracts and search budget: aeo-backlink and aeo-visibility MCP server source (read 2026-11-13)
