# @advance-labs/backlinks

## 0.1.1

### Patch Changes

- Updated dependencies [cc35cb4]
  - @advance-labs/types@0.2.0
  - @advance-labs/crawler@0.2.0
  - @advance-labs/storage@0.1.1

## 0.1.0

Initial release. Extracted the free-source backlink providers (DuckDuckGo, CommonCrawl, Wayback),
contact extraction, and the rate-limited HTTP seam out of `@advance-labs/backlink-mcp`, and added a
`buildBacklinkGraph` builder that assembles those signals into a sampled, layered backlink graph.
