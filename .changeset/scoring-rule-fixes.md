---
'@advance-labs/types': minor
'@advance-labs/schema-validator': patch
'@advance-labs/scoring': minor
---

Fix seven scoring rules that passed or failed for the wrong reason:

- Organization subtypes (`Corporation`, `NGO`, `Restaurant`, ...) now count for `aeo.organization-schema`, `eeat.auth.organization-schema` and `aeo.entity-identity-consistent`. New export `ORGANIZATION_TYPES` / `isOrganizationType` from `@advance-labs/types`.
- `aeo.article-author-schema` is checked per page: every page with Article markup needs a Person.
- `tech.structured-data-present` no longer counts a JSON-LD block that fails to parse.
- `aeo.ai-bots-allowed` fails only when a search or user-fetch bot is blocked (`SEARCH_AI_BOTS`). Blocking only training bots passes.
- `aeo.question-headings` needs question headings on a quarter of pages; `aeo.breadcrumbs` needs breadcrumbs on half of the non-root pages.
- `eeat.expertise.about-page`, `eeat.trust.contact-page` and `eeat.trust.privacy-terms` match on title or h1 as well as URL, and a parsed page needs 50+ words.
- The generated `sitemap.xml` template no longer stamps today's date as every `lastmod`.
