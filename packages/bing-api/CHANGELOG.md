# @advance-labs/bing-api

## 0.2.0

### Minor Changes

- ad6738a: Add Bing Webmaster Tools to the search MCP server, alongside Google.

  Nine new tools: seven Bing read tools, `compare_engines` (both engines side by
  side for one site and range), and `engine_divergence` (classifies each query as
  a Google-specific, Bing-specific, or broad decline — the judgement no
  single-engine connector can make). `bing_keyword_research` returns keyword
  impression data Google Search Console does not expose at all.

  The server moved from `/api/mcp/ga-gsc` to `/api/mcp/search`. The old path
  still works; existing client configs need no change.

  Bing's `GetQueryStats` accepts no date parameter, so the two tools window it
  differently and each says so in its output: `compare_engines` reports the Bing
  side as an unwindowed aggregate, while `engine_divergence` fetches once and
  buckets rows locally on each row's own date. Where an engine cannot answer, the
  affected rows report `insufficient_data` rather than zero clicks.

  Positions are normalized at the client boundary: Bing sends `-1` for "no
  position" on zero-click rows, which is now `null` rather than a number that
  reads as a real ranking.

  Read-only: no Bing write method is called anywhere.

### Patch Changes

- Updated dependencies [f0890cc]
  - @advance-labs/types@0.2.1
