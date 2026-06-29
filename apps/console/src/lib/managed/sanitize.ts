/**
 * Publish-time content sanitization (security H3/H2).
 *
 * LLM-drafted markdown is untrusted at the publish boundary. Before any approved content is handed to
 * a Publisher/CMS, run it through this: strip raw HTML/script, and ensure the ONLY surviving link is
 * the already-agreed `allowedHref` (the customer's own site) — never a model-derived URL.
 */

/** Strip HTML/script and neutralize every link/URL except the agreed `allowedHref`. */
export function sanitizeForPublish(markdown: string, allowedHref: string): string {
  let out = markdown;

  // 1. Remove <script>…</script> blocks, then all remaining HTML tags.
  out = out.replace(/<script[\s\S]*?<\/script>/gi, '');
  out = out.replace(/<[^>]*>/g, '');

  // 2. Markdown links: keep only the agreed href; otherwise reduce to the link text.
  out = out.replace(/\[([^\]]*)\]\(([^)]+)\)/g, (_m, text: string, url: string) =>
    url.trim() === allowedHref ? `[${text}](${allowedHref})` : text,
  );

  // 3. Bare URLs: drop any that aren't the agreed href.
  out = out.replace(/\bhttps?:\/\/[^\s)]+/gi, (u: string) => (u === allowedHref ? u : ''));

  return out;
}
