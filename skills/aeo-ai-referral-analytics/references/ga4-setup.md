# GA4 setup for AI referral traffic

## Regex for AI sources (Session source)

Starting point, case-insensitive match on `sessionSource`:

```
(?i)^(chatgpt\.com|chat\.openai\.com|perplexity(\.ai)?|claude\.ai|gemini\.google\.com|copilot\.microsoft\.com|copilot|edgeservices\.bing\.com)$
```

Only `chatgpt.com` (via OpenAI's documented `utm_source`) is verified against a primary source.
The rest are commonly observed hostnames to confirm in your own data. Review unmatched
sources before trusting totals, and extend the regex when you see a new assistant.
Anchor with `^...$` so `gemini.google.com` does not catch ordinary `google`.

GA4's "matches regex" is a full match, so the anchors are optional there; keep them for
filtering returned rows in code.

## Custom channel group (GA4 UI)

Whether a new channel group applies to past data is a GA4 behaviour we did not verify; test it on a past range before promising history.

1. Admin > Data display > Channel groups > Create new channel group.
2. Add a channel named "AI assistants".
3. Condition: Source, "matches regex", paste the regex above.
4. Drag it **above** "Referral" (channels match top to bottom; the first match wins).
5. Save. Use the new group in Acquisition reports and as a comparison.

## Exploration (no channel group needed)

Explore > Free form. Dimensions: Session source, Landing page. Metrics: Sessions, Engaged
sessions, Key events. Filter: Session source matches regex (above). 

## Checks

- Compare totals from the API (`sessionSource`, filtered in code) with the Explore view;
  they should agree for the same range.
- Look at Session medium for the matched sources. `(none)` suggests missing referrer;
  `referral` suggests a referrer was passed. The mix is informative, not a verdict.
