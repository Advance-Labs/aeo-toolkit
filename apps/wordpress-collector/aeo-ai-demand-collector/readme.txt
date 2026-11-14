=== AEO AI Demand Collector ===
Contributors: advancelabs
Tags: ai, chatgpt, seo, analytics, crawler
Requires at least: 5.8
Tested up to: 6.8
Requires PHP: 7.4
Stable tag: 0.1.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

See how often AI assistants like ChatGPT, Claude and Perplexity read your pages because someone asked them a question.

== Description ==

When a person asks ChatGPT, Claude or Perplexity a question and the assistant opens your page to answer it, your server sees a request from `ChatGPT-User`, `Claude-User` or `Perplexity-User`. This plugin counts those requests and shows them on the AI demand page of your free AEO Toolkit dashboard, next to search-index and training crawls.

**What leaves your site**

* Only requests whose User-Agent names a known AI bot. The check runs on your server, before anything is queued.
* For each one: the bot's User-Agent, the page path (no query string or fragment), the time, and the bot's IP address. The IP is used once to check the request really came from the AI vendor's published ranges, then discarded.
* Human visitors, logged-in users, cookies and query strings are never read or sent.

**How it sends**

Hits are queued and sent as one batched, non-blocking request, after your page has been served. Visitors never wait for it.

You need an AEO Toolkit account (free) and a collector key from its AI demand page.

== Installation ==

1. Upload the `aeo-ai-demand-collector` folder to `/wp-content/plugins/`, or install the zip from Plugins > Add New.
2. Activate it.
3. In your AEO Toolkit dashboard, open AI demand and create a collector key.
4. Go to Settings > AI demand collector, paste the key and save.
5. If your site is behind Cloudflare or another proxy, choose that under "Where is the visitor IP?" so IP verification works.

== Frequently Asked Questions ==

= Does it slow my site down? =

No. Ordinary visits return immediately after one regular-expression check. AI-bot hits are queued and posted after the response, without waiting for a reply.

= Why is a page I know AI read not counted? =

Full-page caching (a caching plugin, host cache or CDN) can serve the page without running WordPress, so the plugin never sees the request. For CDN or host-level installs use the Cloudflare Worker or Vercel drain options on the AI demand page instead.

= Which bots are counted? =

ChatGPT-User, OAI-SearchBot, GPTBot, Claude-User, Claude-SearchBot, ClaudeBot, Perplexity-User, PerplexityBot, MistralAI-User, DuckAssistBot, Meta-ExternalFetcher, Meta-ExternalAgent, Amazonbot, Bytespider and CCBot. Fetches made for a person's question are reported separately from search-index and training crawls.

= What is removed on uninstall? =

Deleting the plugin removes the collector key, the IP setting and any queued hits.

== Privacy ==

This plugin sends data to an external service, https://aeo.advancelabs.dev (AEO Toolkit by Advance Labs Inc.), only when a collector key is saved and only for requests made by AI bots: the bot's User-Agent, the page path, a timestamp and the bot's IP address (used for verification, not stored). No visitor data is sent. Privacy policy: https://advancelabs.dev/privacy

== Changelog ==

= 0.1.0 =
* First release.
