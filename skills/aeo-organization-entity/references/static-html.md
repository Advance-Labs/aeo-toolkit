# Organization entity in plain HTML

Paste the `@graph` from the main skill into a `<script type="application/ld+json">` in the
`<head>` (or `<body>`) of the homepage. It must be valid JSON: double quotes, no trailing commas,
no comments, and `&`, `<` written as plain characters inside the script (a script body is not
HTML-decoded, so do not write `&amp;`).

On other pages, either omit the block or include a minimal `WebSite` node whose `publisher`
is `{ "@id": "https://example.com/#organization" }`.

If you build with a static generator or a template include, put the node in one partial included
by the homepage so there is a single copy. If you have several hand-written sites for one company,
keep a shared snippet file and copy it verbatim; the failure mode here is drift.

Check with `curl -s https://example.com/ | grep -c 'application/ld+json'`, then run the
validator on the saved HTML.
