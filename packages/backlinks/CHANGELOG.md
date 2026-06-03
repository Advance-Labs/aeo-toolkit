# @aeo/backlinks

## 0.1.0

Initial release. Extracted the free-source backlink providers (DuckDuckGo, CommonCrawl, Wayback),
contact extraction, and the rate-limited HTTP seam out of `@aeo/backlink-mcp`, and added a
`buildBacklinkGraph` builder that assembles those signals into a sampled, layered backlink graph.
