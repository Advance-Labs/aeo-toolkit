# Scheduling the blogging agent with GitHub Actions

The agent is a stateless Node entrypoint (`node dist/run.js`). One invocation performs a full
pipeline pass: monitor → self-correct → research → write → edit → schedule → publish. Run it daily
on a schedule, or on demand via `workflow_dispatch`.

> **Never inline secrets in `run:` steps.** Pass them only through the `env:` map sourced from
> `${{ secrets.* }}`. BYOK keys are request-scoped inside the process and are never persisted or
> logged by the agent (the run summary it prints contains no secrets).

## Required secrets

Configure these in **Settings → Secrets and variables → Actions**:

| Secret | Purpose |
|---|---|
| `GROQ_API_KEY` | Bulk drafting model (cost-split: cheap, high-throughput). **Required.** |
| `ANTHROPIC_API_KEY` *or* `OPENAI_API_KEY` | Strategic reasoning model (strategy, editor polish, self-correction). At least one **required**; Anthropic is preferred when both are set. |
| `GOOGLE_ACCESS_TOKEN` | Read-only OAuth access token for GSC + GA4 (mint/refresh upstream via `@aeo/google-api`'s `GoogleOAuth`). **Required.** |
| `GA4_PROPERTY_ID` | Numeric GA4 property id. **Required.** |
| `SITE_URL` | Canonical site origin (e.g. `https://example.com`). **Required.** |
| `GSC_SITE_URL` | Search Console property URL (defaults to `SITE_URL`). Optional. |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | Enable the durable `SupabasePostStore`. Set both, or omit both to use the ephemeral JSON-file store. |
| `PUBLISH_WEBHOOK_URL` | Webhook that receives each rendered post (JSON). Omit to run in dry-run (no publish). |
| `PUBLISH_WEBHOOK_TOKEN` | Optional request-scoped bearer token sent in the publish request's `Authorization` header. |
| `DEPLOY_HOOK_URL` | Optional deploy hook pinged (empty POST) after a successful publish. |

Optional non-secret configuration (set as repo/Actions **variables**, not secrets):
`GROQ_MODEL`, `ANTHROPIC_MODEL`, `OPENAI_MODEL`, `MAX_NEW_POSTS_PER_RUN`,
`UNDERPERFORMANCE_THRESHOLD`, `DEDUP_THRESHOLD`, `CONTENT_PILLARS`, `COMPETITORS`, `AUDIENCE`,
`VOICE`, `POST_STORE_PATH`, `POSTS_TABLE`.

## Persistence

Set `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` to use the durable `SupabasePostStore` (a `posts`
table keyed by `slug`); this is the recommended production setup for cross-run state. Without them,
the agent falls back to the `JsonFilePostStore` at `POST_STORE_PATH` (default `./data/posts.json`),
which is ephemeral in CI — so commit it back after each run (shown below).

## Reference workflow

The canonical workflow lives in the app at [`../deploy/blogging-agent.yml`](../deploy/blogging-agent.yml).
The lead copies it to the repository root as `.github/workflows/blogging-agent.yml` (the app must
not edit root files itself). It is reproduced here for convenience:

```yaml
name: blogging-agent

on:
  schedule:
    - cron: '0 13 * * *' # daily at 13:00 UTC
  workflow_dispatch: {}

concurrency:
  group: blogging-agent
  cancel-in-progress: false

jobs:
  run:
    runs-on: ubuntu-latest
    permissions:
      contents: write # only needed if committing the JSON post store back
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter @aeo/blogging-agent build
      - name: Run the agent
        env:
          GROQ_API_KEY: ${{ secrets.GROQ_API_KEY }}
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
          GOOGLE_ACCESS_TOKEN: ${{ secrets.GOOGLE_ACCESS_TOKEN }}
          GA4_PROPERTY_ID: ${{ secrets.GA4_PROPERTY_ID }}
          SITE_URL: ${{ secrets.SITE_URL }}
          GSC_SITE_URL: ${{ secrets.GSC_SITE_URL }}
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
          PUBLISH_WEBHOOK_URL: ${{ secrets.PUBLISH_WEBHOOK_URL }}
          PUBLISH_WEBHOOK_TOKEN: ${{ secrets.PUBLISH_WEBHOOK_TOKEN }}
          DEPLOY_HOOK_URL: ${{ secrets.DEPLOY_HOOK_URL }}
        run: node apps/blogging-agent/dist/run.js
      - name: Persist post store (JSON-store fallback only)
        if: always()
        run: |
          if [ -f apps/blogging-agent/data/posts.json ]; then
            git config user.name "blogging-agent"
            git config user.email "actions@users.noreply.github.com"
            git add apps/blogging-agent/data/posts.json || true
            git commit -m "chore(blogging-agent): update post store" || echo "no changes"
            git push || echo "nothing to push"
          else
            echo "no JSON post store to persist (Supabase store in use)"
          fi
```
