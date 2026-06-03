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
| `PUBLISH_TOKEN` | Git/CMS credential for the live publisher. Omit to run in dry-run (no publish). |
| `PUBLISH_TARGET` | Repo (`owner/name`) or CMS space id for the publisher. Omit for dry-run. |
| `VERCEL_DEPLOY_HOOK_URL` | Optional deploy hook pinged after a publish commit. |

Optional non-secret configuration (set as repo/Actions **variables**, not secrets):
`GROQ_MODEL`, `ANTHROPIC_MODEL`, `OPENAI_MODEL`, `MAX_NEW_POSTS_PER_RUN`,
`UNDERPERFORMANCE_THRESHOLD`, `DEDUP_THRESHOLD`, `CONTENT_PILLARS`, `COMPETITORS`, `AUDIENCE`,
`VOICE`, `POST_STORE_PATH`.

## Persistence

The default `POST_STORE_PATH` is `./data/posts.json` (the `JsonFilePostStore`). In CI this file is
ephemeral, so commit it back after each run (shown below) or switch to the Supabase adapter
(`SupabasePostStore`, currently a typed `// STUB`) for durable cross-run state.

## Reference workflow

Place this at the repository root as `.github/workflows/blogging-agent.yml` (the lead wires the
root workflow; this file is the canonical reference — the app must not edit root files itself):

```yaml
name: blogging-agent

on:
  schedule:
    - cron: '0 13 * * *' # daily at 13:00 UTC
  workflow_dispatch: {}

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
        working-directory: apps/blogging-agent
        env:
          GROQ_API_KEY: ${{ secrets.GROQ_API_KEY }}
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
          GOOGLE_ACCESS_TOKEN: ${{ secrets.GOOGLE_ACCESS_TOKEN }}
          GA4_PROPERTY_ID: ${{ secrets.GA4_PROPERTY_ID }}
          SITE_URL: ${{ secrets.SITE_URL }}
          GSC_SITE_URL: ${{ secrets.GSC_SITE_URL }}
          PUBLISH_TOKEN: ${{ secrets.PUBLISH_TOKEN }}
          PUBLISH_TARGET: ${{ secrets.PUBLISH_TARGET }}
          VERCEL_DEPLOY_HOOK_URL: ${{ secrets.VERCEL_DEPLOY_HOOK_URL }}
        run: node dist/run.js
      - name: Persist post store
        if: always()
        run: |
          git config user.name "blogging-agent"
          git config user.email "actions@users.noreply.github.com"
          git add apps/blogging-agent/data/posts.json || true
          git commit -m "chore(blogging-agent): update post store" || echo "no changes"
          git push || echo "nothing to push"
```
