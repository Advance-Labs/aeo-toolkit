# WordPress

I could not verify specific plugin documentation on 2026-11-13, so check each plugin's current
docs before following a recipe. General approach:

1. View source on the homepage and contact page; list every `ld+json` block. SEO plugins and
   themes often each emit an Organization or LocalBusiness node.
2. Keep one source. If an SEO plugin has a local-business setting, fill it with the confirmed
   NAP and hours and disable the theme's duplicate. If you prefer manual control, disable the
   plugin's local schema and paste one block (see static-html.md) via a header snippet or a
   per-page custom field.
3. Make sure the footer or contact page shows the same NAP as visible text.
4. After changes, clear page cache and re-test the live URL, not the editor preview.
