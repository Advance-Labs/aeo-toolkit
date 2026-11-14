# FAQ markup in WordPress

- **Yoast SEO and Rank Math** both ship FAQ blocks for the block editor that render a visible Q&A
  section and emit matching FAQPage markup. Prefer these over a hand-written script: the visible
  text and the markup come from the same fields.
- **Extend vs replace:** use the plugin block for normal FAQs. Hand-write JSON-LD only for
  structures the block cannot express, and then disable the block on that page so the page
  does not carry two FAQPage nodes.
- **Elementor/Divi/accordion plugins** often render a visible accordion with no markup, or
  markup the SEO plugin also generates. Pick one source, and look at view-source.
- A FAQ plugin that loads answers through AJAX on click leaves the answers out of the HTML.
  Choose one that outputs them in the markup.
- For community Q&A (QAPage), use a Q&A or forum plugin that supports it (and lets visitors submit
  answers) rather than a FAQ block.

Since FAQ rich results no longer exist in Google, there is no reason to buy a plugin or add
markup to every post to "get FAQ stars".
