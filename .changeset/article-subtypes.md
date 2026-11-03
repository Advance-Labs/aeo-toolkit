---
"@advance-labs/schema-validator": patch
---

Count every schema.org Article subtype (TechArticle, ScholarlyArticle, Report, APIReference and the rest) as an Article, so `hasArticle` and the `aeo.article-author-schema` rule no longer fail pages marked up with a valid subtype.
