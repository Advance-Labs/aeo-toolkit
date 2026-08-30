/**
 * Pure renderers for the llms.txt format (https://llmstxt.org).
 *
 * The spec is intentionally simple Markdown:
 *   # Site Name                      (required H1)
 *   > One-line summary               (optional blockquote)
 *   Free-form details paragraph(s)   (optional)
 *   ## Section                       (one per section)
 *   - [title](url): description      (one bullet per entry)
 *   ## Optional / Contact / License  (optional trailing metadata)
 *
 * `llms-full.txt` is the expanded variant: same header, but each linked page is
 * inlined as its own `## Title` section with the page URL and any description,
 * so an LLM can ingest the whole site context from a single file.
 *
 * Both functions are pure (string in, string out) and never touch the network.
 */
import type { LlmsTxtEntry, LlmsTxtManifest, ParsedHtml } from '@advance-labs/types';

/** llmstxt.org spec revision this renderer targets; surfaced as an HTML comment header. */
export const LLMS_TXT_SPEC_VERSION = '2024-09';

/** Collapse internal whitespace/newlines so a value is safe on a single Markdown line. */
function oneLine(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

/** Render a single `- [title](url): description` bullet (description optional). */
function renderEntry(entry: LlmsTxtEntry): string {
  const title = oneLine(entry.title) || entry.url;
  const base = `- [${title}](${entry.url})`;
  const description = entry.description ? oneLine(entry.description) : '';
  return description === '' ? base : `${base}: ${description}`;
}

/**
 * Render the shared header block (spec comment, H1, optional summary blockquote,
 * optional details paragraph). Reused by both `llms.txt` and `llms-full.txt`.
 */
function renderHeader(manifest: LlmsTxtManifest): string[] {
  const lines: string[] = [];
  lines.push(`<!-- llms.txt — llmstxt.org spec ${LLMS_TXT_SPEC_VERSION} -->`);
  lines.push(`# ${oneLine(manifest.siteName) || 'Website'}`);

  const summary = manifest.summary ? oneLine(manifest.summary) : '';
  if (summary !== '') {
    lines.push('');
    lines.push(`> ${summary}`);
  }

  const details = manifest.details ? manifest.details.trim() : '';
  if (details !== '') {
    lines.push('');
    lines.push(details);
  }

  return lines;
}

/** Render the optional trailing metadata sections (Contact / License). */
function renderTrailer(manifest: LlmsTxtManifest): string[] {
  const lines: string[] = [];

  const contact = manifest.contact ? oneLine(manifest.contact) : '';
  if (contact !== '') {
    lines.push('');
    lines.push('## Contact');
    lines.push('');
    lines.push(contact);
  }

  const license = manifest.license ? oneLine(manifest.license) : '';
  if (license !== '') {
    lines.push('');
    lines.push('## License');
    lines.push('');
    lines.push(license);
  }

  return lines;
}

/**
 * Render the curated `llms.txt`: header + one `## Section` per non-empty section,
 * each with `- [title](url): description` bullets, then optional contact/license.
 * Trailing newline included so the file is POSIX-clean.
 */
export function renderLlmsTxt(manifest: LlmsTxtManifest): string {
  const lines = renderHeader(manifest);

  for (const section of manifest.sections) {
    if (section.entries.length === 0) continue;
    lines.push('');
    lines.push(`## ${oneLine(section.heading) || 'Links'}`);
    lines.push('');
    for (const entry of section.entries) {
      lines.push(renderEntry(entry));
    }
  }

  lines.push(...renderTrailer(manifest));

  return `${lines.join('\n').trimEnd()}\n`;
}

/**
 * Render the expanded `llms-full.txt`: the same header, then one `## Title`
 * section per crawled page inlining its URL and (when available) its meta
 * description as the page's content stand-in. `pages` are matched to manifest
 * entries by URL so titles/descriptions stay consistent with the curated file;
 * pages with no manifest entry still get a section keyed off their parsed meta.
 */
export function renderLlmsFullTxt(manifest: LlmsTxtManifest, pages: ParsedHtml[]): string {
  const lines = renderHeader(manifest);

  // Index curated entries by URL for title/description lookup.
  const entryByUrl = new Map<string, LlmsTxtEntry>();
  for (const section of manifest.sections) {
    for (const entry of section.entries) {
      if (!entryByUrl.has(entry.url)) entryByUrl.set(entry.url, entry);
    }
  }

  const seen = new Set<string>();
  for (const page of pages) {
    if (seen.has(page.url)) continue;
    seen.add(page.url);

    const entry = entryByUrl.get(page.url);
    const title = oneLine(entry?.title ?? page.meta.title ?? page.url) || page.url;
    const description = entry?.description ?? page.meta.description;

    lines.push('');
    lines.push(`## ${title}`);
    lines.push('');
    lines.push(`Source: ${page.url}`);
    if (description && oneLine(description) !== '') {
      lines.push('');
      lines.push(oneLine(description));
    }
  }

  lines.push(...renderTrailer(manifest));

  return `${lines.join('\n').trimEnd()}\n`;
}
