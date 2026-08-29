# syntax=docker/dockerfile:1

# AEO Toolkit console — self-hosting image.
#
# Multi-stage, pnpm-workspace aware. The layer order exists to keep dependency
# installation cached across source edits: manifests are copied and installed
# BEFORE any source, so editing a .ts file does not re-run a full pnpm install.
#
# Build from the REPO ROOT (the workspace needs every package manifest):
#   docker build -t aeo-toolkit .
#
# See docs/SELF_HOSTING.md.

ARG NODE_VERSION=24-alpine

# ---------- deps: install the full workspace ----------
FROM node:${NODE_VERSION} AS deps
RUN corepack enable
WORKDIR /repo

# Workspace manifests only. Copying package.json files before source is what makes
# the install layer cacheable; a plain `COPY . .` here would invalidate it on every
# source change and turn a 5-second rebuild into a 3-minute one.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json tsconfig.json ./
COPY apps/console/package.json                 apps/console/
COPY apps/chrome-extension/package.json        apps/chrome-extension/
COPY packages/backlinks/package.json           packages/backlinks/
COPY packages/blogging/package.json            packages/blogging/
COPY packages/config/package.json              packages/config/
COPY packages/crawler/package.json             packages/crawler/
COPY packages/google-api/package.json          packages/google-api/
COPY packages/html-parser/package.json         packages/html-parser/
COPY packages/llm/package.json                 packages/llm/
COPY packages/mcp-core/package.json            packages/mcp-core/
COPY packages/net-guard/package.json           packages/net-guard/
COPY packages/orchestrator/package.json        packages/orchestrator/
COPY packages/pdf/package.json                 packages/pdf/
COPY packages/schema-validator/package.json    packages/schema-validator/
COPY packages/scoring/package.json             packages/scoring/
COPY packages/storage/package.json             packages/storage/
COPY packages/types/package.json               packages/types/
COPY packages/ui/package.json                  packages/ui/

# Deliberately no BuildKit cache mount here. It would speed up rebuilds, but it also
# makes the image un-buildable on the legacy builder (and anywhere buildx is missing),
# which defeats the point of a self-hosting image. Layer caching on the manifests above
# already delivers most of the benefit.
RUN pnpm install --frozen-lockfile

# ---------- builder: compile packages, then the Next app ----------
FROM node:${NODE_VERSION} AS builder
RUN corepack enable
WORKDIR /repo

COPY --from=deps /repo ./
COPY . .

# Emits .next/standalone (see next.config.mjs).
ENV BUILD_STANDALONE=1
# Empty on purpose: a self-hosted instance serves its own assets rather than
# fetching them from aeo.advancelabs.dev. See the assetPrefix note in next.config.mjs.
ENV NEXT_PUBLIC_ASSET_PREFIX=""
ENV NEXT_TELEMETRY_DISABLED=1

# Build packages SEQUENTIALLY and cap the heap. Turbo's default is to fan out across
# cores, which reliably OOM-kills (exit 137) on a small VM or a 2 GB VPS — the exact
# machines people self-host on. Slower, but it completes on modest hardware instead of
# failing with a signal that looks nothing like "out of memory".
ENV NODE_OPTIONS=--max-old-space-size=3072
RUN pnpm exec turbo run build --concurrency=1

# ---------- runner: standalone server only ----------
FROM node:${NODE_VERSION} AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Run unprivileged. `node` (uid 1000) ships with the base image.
RUN mkdir -p /app && chown -R node:node /app
USER node

# The standalone output already contains the traced runtime dependencies, so no
# install runs here. static/ and public/ are NOT included in it and must come over
# separately, or the app boots and serves an unstyled page with no chunks.
COPY --from=builder --chown=node:node /repo/apps/console/.next/standalone ./
COPY --from=builder --chown=node:node /repo/apps/console/.next/static ./apps/console/.next/static
COPY --from=builder --chown=node:node /repo/apps/console/public ./apps/console/public

EXPOSE 3000

# Fails the container if the app stops serving, so `docker ps` reflects reality.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Standalone keeps the workspace layout, so the server entrypoint sits under the app path.
CMD ["node", "apps/console/server.js"]
