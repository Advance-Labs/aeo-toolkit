# @aeo/types

The single source of truth for shared domain types across the AEO Toolkit. No runtime dependencies.

## Usage

```ts
import type { AuditReport, Score, ScoringContext, CrawlResult, ParsedHtml } from '@aeo/types';
```

## Domains

| Module | Types |
|--------|-------|
| `crawl` | `Url`, `CrawlOptions`, `CrawledPage`, `PageResource`, `RobotsTxt`, `SitemapEntry`, `SiteFilePresence`, `CrawlResult`, `AiBotName` |
| `html` | `ParsedHtml`, `MetaTags`, `OpenGraph`, `TwitterCard`, `HeadingNode`, `ImageInfo`, `LinkInfo`, `ContentSignals` |
| `schema` | `StructuredDataItem`, `StructuredDataReport`, `StructuredDataFormat`, `AeoSchemaType` |
| `scoring` | `Rule`, `RuleOutcome`, `ScoringContext`, `Finding`, `ScoreCategory`, `Score`, `ScoreGrade` |
| `audit` | `AuditReport`, `GeneratedTemplate`, `AuditMeta` |
| `eeat` | `EeatReport`, `EeatPillar`, `EeatSignal`, `EeatPillarKey` |
| `llmstxt` | `LlmsTxtManifest`, `LlmsTxtSection`, `LlmsTxtEntry`, `LlmsTxtOutput` |
| `google` | `Ga4Report`, `GscReport`, `GoogleOAuthTokens`, `TokenStore`, … |
| `llm` | `LlmCompletionRequest`, `LlmCompletionResponse`, `LlmMessage`, `Citation`, `LlmProvider` |
| `mcp` | `McpToolDefinition`, `McpServerOptions`, `RateLimitConfig`, `VisibilityCheck`, `CompetitorVisibility` |

## Status

✅ Implemented. This package only ships types plus a `TYPES_VERSION` constant.
