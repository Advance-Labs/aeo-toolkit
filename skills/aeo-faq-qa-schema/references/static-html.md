# FAQ markup in plain HTML

```html
<section id="faq">
  <h2>Frequently asked questions</h2>
  <details><summary>Can I cancel at any time?</summary>
    <p>Yes. Cancel from the billing page.</p></details>
</section>
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[
 {"@type":"Question","name":"Can I cancel at any time?",
  "acceptedAnswer":{"@type":"Answer","text":"Yes. Cancel from the billing page."}}]}
</script>
```

Keep the wording identical in both places. With more than a few questions, generate both from
one source file at build time; hand-edited copies drift. Escape double quotes in JSON strings
and write apostrophes and ampersands as plain characters, not HTML entities, inside the script.
