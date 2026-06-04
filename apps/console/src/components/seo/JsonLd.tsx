/**
 * Renders a JSON-LD structured-data block. The toolkit dogfoods its own AEO advice: every page
 * ships machine-readable schema.org data so answer engines can cite it confidently.
 */
export function JsonLd({
  data,
}: {
  data: Record<string, unknown> | Record<string, unknown>[];
}): React.ReactElement {
  // App-authored structured data (no user input). Escape `<` so a stray `</script>` can never
  // break out of the tag — the standard hardening for inline JSON-LD.
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
