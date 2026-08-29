# Self-hosting the AEO Toolkit

Run the console on your own machine or server. Useful if you would rather not send
Search Console data to someone else's deployment, or you just want it local.

Everything below was run end to end on 29 Aug 2026 (Docker 29, arm64) before being
written down. Where something is **not** verified, it says so.

## Quickstart

No accounts, no API keys, no database.

```bash
git clone https://github.com/Advance-Labs/aeo-toolkit.git
cd aeo-toolkit
docker compose up --build
```

Then open <http://localhost:3000>. The audit, E-E-A-T, llms.txt, graph and chat tools
all work in this state.

Prefer plain Docker:

```bash
docker build -t aeo-toolkit .
docker run -p 3000:3000 aeo-toolkit
```

Build from the **repo root** either way — the build needs every workspace manifest.

### What you get with nothing configured

| Works | Needs configuration |
|---|---|
| Technical SEO + AEO audit (54 rules) | Search Console / GA4 tools |
| E-E-A-T report | Anything requiring Google OAuth |
| llms.txt generator | Durable login across restarts |
| Entity graph, chat | Billing, managed tier |

Verified: a `POST /api/audit/technical` against `https://example.com` returned a full
scored report from a container started with no environment variables at all.

## Build requirements

The build compiles the whole workspace, which is the memory-hungry part.

- **~4 GB of RAM available to the Docker VM.** A 2 GB VM **fails**, and it fails
  confusingly: Turbo's parallel build gets OOM-killed and you see `exited (137)` with
  no mention of memory. The Dockerfile already forces a sequential build
  (`--concurrency=1`) and caps the Node heap to make small machines work, but there is
  a floor.
- **~10 GB of free disk** for the build. It fills up faster than you expect.
- **BuildKit is not required.** The Dockerfile deliberately avoids cache mounts so it
  builds on the legacy builder and anywhere `buildx` is missing.

On Docker Desktop or Colima, raise the VM's memory before the first build:

```bash
colima start --cpu 4 --memory 8
```

Measured: image **339 MB**, first build a few minutes, container reports `healthy`
about 10 seconds after start, and runs as the unprivileged `node` user (uid 1000).

## Connecting Google Search Console

Optional. Skip it unless you want the GSC and GA4 tools.

> **Not verified end to end.** The container runs and the OAuth code path is the same
> one the hosted deployment uses, but the full browser consent flow against a
> self-hosted instance has not been walked through on a fresh Google Cloud project.
> If you hit a snag here, please open an issue — this is the part most likely to have
> a gap.

1. In [Google Cloud Console](https://console.cloud.google.com), create a project.
2. Enable **both** the Search Console API and the Google Analytics Data API. Missing
   this is the most common failure and it surfaces as a permission error that looks
   like the app is broken.
3. Create an OAuth 2.0 **Web application** client.
4. Add an authorised redirect URI exactly matching your instance, e.g.
   `http://localhost:3000/api/auth/callback`. It must match character for character,
   including the port and the absence of a trailing slash.
5. Put the credentials in a `.env` file next to `docker-compose.yml`:

   ```bash
   GOOGLE_CLIENT_ID=...
   GOOGLE_CLIENT_SECRET=...
   GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/callback
   ```

6. `docker compose up -d` and connect from the console.

You also need Search Console access to whichever property you want to analyse. The
toolkit cannot grant that.

## What persists, and what does not

**By default, nothing.** With no `SUPABASE_URL`, OAuth tokens are held in memory and
are gone on every restart, so you reconnect Google each time. That is fine for a trial
and wrong for anything you leave running.

For durable tokens, set:

```bash
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
TOKEN_ENCRYPTION_KEY=...   # enables AES-256-GCM encryption at rest
```

> **Supabase is currently the only durable store.** There is no Postgres adapter yet,
> so a plain Postgres container will not work — the compose file deliberately does not
> ship one rather than implying support that does not exist. Tracked separately.

Set `TOKEN_ENCRYPTION_KEY` whenever you set the Supabase vars. Without it the tokens
are stored unencrypted, and they are live Google credentials.

## Environment variables

| Variable | Default | Effect |
|---|---|---|
| `PORT` | `3000` | Port the server listens on |
| `NEXT_PUBLIC_ASSET_PREFIX` | `""` in Docker | Where JS/CSS load from. **Leave empty when self-hosting** — unset makes a production build fetch assets from `aeo.advancelabs.dev` |
| `GOOGLE_CLIENT_ID` / `_SECRET` / `_REDIRECT_URI` | unset | Enables the GSC + GA4 tools |
| `GOOGLE_ACCESS_TOKEN` | unset | A pre-issued token for single-user local dev, skipping the OAuth round trip |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | unset | Durable token storage instead of in-memory |
| `TOKEN_ENCRYPTION_KEY` | unset | Encrypts stored tokens at rest (AES-256-GCM) |

## Known limitations

- **Social preview images point at `aeo.advancelabs.dev`.** `og:image`, `twitter:image`
  and the JSON-LD logo come from the project's `metadataBase`, not `assetPrefix`, so
  they still reference the hosted instance. Cosmetic — pages render and function
  normally — but link previews from your instance will show Advance Labs' artwork.
- **No Postgres token store** (see above).
- **The MCP servers are served by this same app.** Point your MCP client at your own
  instance's URL, not `aeo.advancelabs.dev`.

## Troubleshooting

**`exited (137)` during build** — out of memory, not a build error. Give the Docker VM
at least 4 GB.

**Page loads but is unstyled, chunks 404** — `NEXT_PUBLIC_ASSET_PREFIX` is not empty,
so the browser is fetching assets from another origin. Set it to an empty string.

**`the --mount option requires BuildKit`** — you are on an old Dockerfile. Current
`main` has no cache mounts; pull again.

**Google connect fails with a permission error** — usually step 2 above, the APIs are
not enabled on the Cloud project.
