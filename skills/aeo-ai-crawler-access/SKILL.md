---
name: aeo-ai-crawler-access
description: Check and fix whether AI crawlers can reach a site, and decide which ones to allow. Use when someone asks "why isn't ChatGPT or Perplexity citing my site", "should I block GPTBot", "allow AI crawlers", "AI bots blocked", "robots.txt for AI", "Cloudflare is blocking AI bots", or when the audit fails aeo.ai-bots-allowed or tech.robots-present. Covers training bots vs search and user-fetch bots, robots.txt, and CDN/WAF blocking that overrides robots.txt. Uses the aeo-visibility MCP server if connected; works without it.
---

# AI crawler access

Answer engines can only cite what their bots can fetch. This skill checks robots.txt and the
CDN in front of it, then helps choose which AI bots to allow. Blocking AI *training* while
allowing AI *search* is a legitimate choice, and the audit rules do not always know that.

## When this matters / when it doesn't

It matters when a site wants to appear in ChatGPT search, Claude, Perplexity, Gemini or
Google AI Overviews and has never looked at its robots.txt or its CDN bot settings.

It does **not** matter much, and the finding may be a deliberate choice, when:

- The owner has decided not to be used for model training. Blocking `GPTBot` or `ClaudeBot`
  is a policy decision, not a defect. **Ask** before recommending they undo it.
- The site is private, paywalled or intentionally unlisted.
- Only the training bots are blocked and the search/retrieval bots are allowed. That site
  can still be cited. The audit rule may still fail it (see below). Say so plainly.

## Detect

Rules owned:

- `tech.robots-present`: passes when `/robots.txt` answers 2xx with a non-HTML content type.
  A 404, or a catch-all that returns the app shell as `text/html`, fails.
- `aeo.ai-bots-allowed`: fails when robots.txt disallows `/` for any of **GPTBot, ClaudeBot,
  PerplexityBot, OAI-SearchBot or Google-Extended**. No robots.txt means nothing is blocked
  and the rule passes. Note the list mixes training bots (GPTBot, ClaudeBot, Google-Extended)
  with search bots (OAI-SearchBot, PerplexityBot). A site that blocks only the training bots on
  purpose will fail this rule. Report it as "intentional, rule is blunt", not as a bug.

With the MCP server: call `analyze_website_aeo` on the site root. The result lists AI-bot
access per bot.

Without it:

```bash
curl -sI https://example.com/robots.txt | head -5      # 200 and not text/html
curl -s  https://example.com/robots.txt
# Does the CDN treat bots differently from robots.txt? Compare status codes:
curl -s -o /dev/null -w "%{http_code}\n" -A "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.4; +https://openai.com/gptbot" https://example.com/
curl -s -o /dev/null -w "%{http_code}\n" -A "Mozilla/5.0 (compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)" https://example.com/
```

A 403, 429 or a challenge page for a bot while a normal browser gets 200 means something in
front of the site is blocking it, whatever robots.txt says. Caveat: a CDN that verifies bots
by IP range will let the real bot through and block your spoofed curl, so a `200` here proves
little and a `403` is a hint, not proof. Server logs and the CDN's bot analytics are the real
evidence.

## Decide

Each vendor documents separate user agents for separate jobs. Verified against their own
pages on 2026-11-13.

| Operator | User agent | Job | Blocking it means |
|---|---|---|---|
| OpenAI | `OAI-SearchBot` | Surfaces sites in ChatGPT search | Not shown in ChatGPT search answers (can still appear as plain links) |
| OpenAI | `GPTBot` | Crawls content that may train foundation models | Opt-out of training |
| OpenAI | `ChatGPT-User` | Fetches a page when a user asks ChatGPT or a Custom GPT | OpenAI says robots.txt rules may not apply to it |
| OpenAI | `OAI-AdsBot` | Checks landing pages of ads submitted to ChatGPT | Only matters if you advertise there |
| Anthropic | `ClaudeBot` | Collects content that may contribute to training | Opt-out of training |
| Anthropic | `Claude-SearchBot` | Indexes content to improve search results | May reduce visibility in Claude search answers |
| Anthropic | `Claude-User` | Fetches when a user asks Claude a question | May reduce visibility for user-directed web search |
| Perplexity | `PerplexityBot` | Surfaces sites in Perplexity search; not used for foundation-model training | Not shown in Perplexity results |
| Perplexity | `Perplexity-User` | Fetches when a user asks | Perplexity says it generally ignores robots.txt |
| Google | `Googlebot` | Search, and therefore AI Overviews and AI Mode | Leaves Search entirely |
| Google | `Google-Extended` | Product token only, no separate fetch. Controls use for Gemini training and for grounding in Gemini Apps / Vertex | Does not affect Search inclusion or ranking |
| Apple | `Applebot` | Powers Spotlight, Siri, Safari search; data may also train Apple models | Leaves Apple search |
| Apple | `Applebot-Extended` | Opt-out token for training Apple foundation models | Opt-out of training; Applebot can still crawl |

Things this table settles that people get wrong:

- **There is no robots.txt switch for Google AI Overviews.** Google says `Googlebot` is the
  control, and `nosnippet`, `data-nosnippet`, `max-snippet` or `noindex` limit what is shown.
  `Google-Extended` does not remove you from AI Overviews.
- **User-fetch bots (`ChatGPT-User`, `Perplexity-User`, `Claude-User`) act for a person.**
  OpenAI and Perplexity both say robots.txt may not govern them. Do not expect a `Disallow`
  to stop them, and do not call a hit from one a violation.
- OpenAI and Perplexity both say robots.txt changes can take up to about 24 hours to take effect. Anthropic gives no number.

Recommended defaults, offered as options, not orders:

1. **Wants to be cited** (most sites): allow all the search and user-fetch bots. Training bots are
   a separate choice for the owner.
2. **Wants no training but wants citations**: block `GPTBot`, `ClaudeBot`, `Google-Extended`,
   `Applebot-Extended` (and optionally `CCBot`, Common Crawl's crawler; its docs were not
   re-checked for this skill). Allow `OAI-SearchBot`, `Claude-SearchBot`, `PerplexityBot`,
   `Googlebot`, `Bingbot`. Expect `aeo.ai-bots-allowed` to fail for this site and say that the
   failure is the chosen trade-off.
3. **Wants out of AI entirely**: block everything above, and understand that this removes the
   site from AI citations. Confirm that is the intent.

Anthropic also says that since 2026-10-30 it honours a machine-readable "no AI training"
preference signal based on the IETF aipref draft, and that a robots.txt rule naming `ClaudeBot`
takes priority over the general signal. Google says it intends to support the same shared
signal in early 2027. The standard is still a draft, so treat it as extra, not a replacement
for naming the bots.

## Implement

Shape of the fix, any stack:

1. Serve a real `/robots.txt` (text/plain, 200). Reference the sitemap.
2. Write explicit groups for the bots the decision above names. A group naming a bot replaces
   the `User-agent: *` group for that bot, so repeat any `Disallow` paths you still want.
3. Check the layer in front of the origin (CDN, WAF, host "bot protection", plugins).

```
User-agent: *
Allow: /

# Allowed: search and retrieval
User-agent: OAI-SearchBot
Allow: /
User-agent: Claude-SearchBot
Allow: /
User-agent: PerplexityBot
Allow: /

# Opt out of training only (delete this block if the owner is happy to be trained on)
User-agent: GPTBot
Disallow: /
User-agent: ClaudeBot
Disallow: /
User-agent: Google-Extended
Disallow: /
User-agent: Applebot-Extended
Disallow: /

Sitemap: https://example.com/sitemap.xml
```

**The CDN overrides robots.txt.** robots.txt is a request; a WAF rule is enforcement. If a bot
gets a 403 or a challenge at the edge it never reads robots.txt. Anthropic says as much:
blocking its IP ranges can stop it reading robots.txt at all, so an opt-out should be done in
robots.txt, not by IP. Common culprits:

- **Cloudflare managed robots.txt / AI Crawl Control.** Setting the AI *Training* policy to
  Disallow adds managed `Disallow` lines (Amazonbot, Applebot-Extended, Bytespider, CCBot,
  ClaudeBot, Google-Extended, GPTBot, meta-externalagent) and, with Bot Preference Sync on,
  enables blocking at the edge for AI training crawlers. Cloudflare says mixed-use crawlers are
  excluded from the edge block, and the Search and Agent policies add their own directives when
  set to Block. If the site has no robots.txt, Cloudflare serves one with those rules. Check
  Security settings, Bot traffic, "AI Crawler and Agent access policies".
- A custom WAF rule, rate limit or "Bot Fight Mode" that challenges unknown user agents.
- Host-level firewall plugins (WordPress security plugins are the usual source).

If you want a bot through a WAF, allow it by **user agent plus published IP range**, not user
agent alone, because user agents are trivially forged. OpenAI publishes ranges at
`openai.com/searchbot.json`, `gptbot.json`, `chatgpt-user.json`; Perplexity at
`perplexity.ai/perplexitybot.json` and `perplexity-user.json`; Anthropic links its list from
the crawler help page. Perplexity's guide walks through a Cloudflare Skip rule ordered above any
blocking rule.

Per-stack file recipes: read `references/nextjs.md`, `references/astro.md`,
`references/wordpress.md` or `references/static-html.md`.

## Verify

1. `curl -s https://example.com/robots.txt` shows the groups you intended, as text/plain.
2. Re-run `analyze_website_aeo`. `tech.robots-present` should pass. `aeo.ai-bots-allowed`
   should pass if you allowed all five key bots; if you chose option 2 or 3 it will fail
   by design, and the report should say which bots are blocked on purpose.
3. Check the edge: look in the CDN's bot analytics or server logs for 403/429 on the search
   bots' user agents over the last few days. No blocks there is the real pass.
4. Allow a day for the bots to pick up the change.

## Pitfalls

- Blocking `Google-Extended` and expecting to leave AI Overviews. It does not.
- Adding `User-agent: *` / `Disallow: /` "temporarily" on a staging config that ships to
  production. Check the live file after every deploy.
- A catch-all route that returns the app shell for `/robots.txt`. The audit (and some
  crawlers) treat an HTML response as "no robots.txt".
- Allowing a bot in robots.txt and leaving a Cloudflare AI policy on Block. Both layers must agree.
- Treating `ChatGPT-User` or `Perplexity-User` traffic as crawling. It is a person asking.
- `Disallow:` with an empty value allows everything; `Disallow: /` blocks everything. One
  character, opposite meanings.
- Legacy names (`Claude-Web`, `anthropic-ai`) still appear in some lists and the toolkit still probes
  them, but Anthropic's current help page lists only ClaudeBot, Claude-User and Claude-SearchBot.
- Naming a bot in a group with no rules does nothing useful. Give it `Allow: /` or `Disallow: /`.

## Sources

- OpenAI crawlers: https://platform.openai.com/docs/bots (verified 2026-11-13)
- Anthropic crawlers: https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler (verified 2026-11-13)
- Perplexity crawlers and WAF guide: https://docs.perplexity.ai/guides/bots (verified 2026-11-13)
- Google common crawlers (Google-Extended): https://developers.google.com/search/docs/crawling-indexing/google-common-crawlers (verified 2026-11-13)
- Google AI features and your website: https://developers.google.com/search/docs/appearance/ai-features (verified 2026-11-13)
- Apple Applebot: https://support.apple.com/en-us/119829 (verified 2026-11-13)
- Cloudflare managed robots.txt: https://developers.cloudflare.com/bots/additional-configurations/managed-robots-txt/ (verified 2026-11-13)
- robots.txt introduction (Google): https://developers.google.com/search/docs/crawling-indexing/robots/intro (verified 2026-11-13)
- Common Crawl's CCBot page was not fetched; its role is stated from general knowledge and not verified.
