# Article and author schema in plain HTML

Add one `ld+json` block per article page, with the graph from the main skill, hand-edited per
page: headline, URL, dates, image, author. Keep the byline in the HTML and the `author` in the
JSON identical. Put the author's `Person` node on the author page and reference it by `@id`
from articles; if you cannot guarantee the author page is crawled, repeat the Person node in the
article's graph with identical values.

If there are more than a handful of articles, template it (an include or a small build script)
so the dates and author come from one place; hand-copied blocks drift. Use ISO 8601 dates with
an offset. Validate each template output once, then spot-check new posts.
