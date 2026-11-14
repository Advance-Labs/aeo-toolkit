# AEO AI Demand Collector (WordPress plugin)

Counts the requests AI assistants make to a WordPress site (`ChatGPT-User`, `Claude-User`, `Perplexity-User`, and the search and training bots) and sends daily counts to the AEO Toolkit AI demand dashboard. The User-Agent filter runs inside WordPress, so human visits never leave the site. Apache-2.0.

- `aeo-ai-demand-collector/` is the plugin. Zip that folder to install it: `cd apps/wordpress-collector && zip -r aeo-ai-demand-collector.zip aeo-ai-demand-collector`.
- Settings: Settings > AI demand collector. Paste the collector key from the AI demand page of your dashboard.
- `AEO_COLLECTOR_AI_BOTS` in the plugin must stay identical to `AI_BOT_PATTERN` in the console (`apps/console/src/lib/ai-bots/classify.ts`, private repo). `pnpm test` here checks the list; the console repo's test checks this file when both repos are checked out side by side.
- Not submitted to WordPress.org. The readme.txt is in WordPress.org format. Note WordPress.org requires a GPL-compatible licence; Apache-2.0 is GPLv3-compatible only, so check before submitting.
- Hooks: `aeo_collector_client_ip` filters the IP sent for vendor-range verification (for unusual proxy setups).
