# Apps

| App | What | Deploy target |
|-----|------|---------------|
| [`chrome-extension`](chrome-extension) | Single-page AEO/GEO audit that runs locally in the browser (zero server calls). Built from the repo, shipped via the Chrome Web Store. | Chrome Web Store |
| [`docs`](docs) | Astro + Starlight documentation site, published at [docs.advancelabs.dev/aeo-toolkit](https://docs.advancelabs.dev/aeo-toolkit). Sources its content directly from [`../docs`](../docs). | Vercel |

The hosted console (the web tools at [advancelabs.dev/tools](https://advancelabs.dev/tools) and the three MCP
servers) moved to a private repository on 2026-10-20 and is not open source.

## Running

```bash
pnpm --filter @advance-labs/chrome-extension build
pnpm --filter @advance-labs/docs dev             # docs site at localhost:4321
```
