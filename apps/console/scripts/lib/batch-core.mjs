/**
 * batch-core.mjs — pure helpers for the batch scorecard runner. No network, no filesystem, so the
 * fiddly bits (target-file parsing, URL normalization, slugs, CSV) are unit-tested in isolation
 * (see src/lib/audit-batch-core.test.ts). The runner (seo-audit-batch.mjs) wires these to I/O.
 */

const SEV_RANK = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };

/** Columns of the generated index.csv, in order. */
export const CSV_COLUMNS = ["url", "score", "grade", "pages", "failed", "critical", "topFix"];

/**
 * Normalize a raw target token into an origin-ish URL, or `null` if it isn't a usable domain.
 * Adds `https://` when no scheme is present, lowercases the host, strips a trailing slash and
 * surrounding quotes, and rejects anything without a dotted hostname.
 */
export function normalizeUrl(input) {
  if (input == null) return null;
  let s = String(input).trim().replace(/^["']|["']$/g, "");
  if (!s || s.startsWith("#")) return null;
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`;
  try {
    const u = new URL(s);
    if (!u.hostname.includes(".")) return null;
    u.hostname = u.hostname.toLowerCase();
    const path = u.pathname === "/" ? "" : u.pathname.replace(/\/+$/, "");
    return u.origin + path;
  } catch {
    return null;
  }
}

/**
 * Parse a targets file (plain list or CSV) into a de-duplicated array of normalized URLs.
 * - One target per line; blank lines and `#` comments are ignored.
 * - For CSV rows, a `url`/`domain`/`website`/`site` header column is preferred; otherwise the
 *   first column is used. A header row naming that column is detected and skipped.
 */
export function parseTargets(text) {
  const lines = String(text ?? "").split(/\r?\n/);
  const out = [];
  let urlCol = null; // null until a header is seen; stays null for headerless lists
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;

    let cell = line;
    if (line.includes(",")) {
      const cols = line.split(",").map((c) => c.trim());
      const headerIdx = cols.findIndex((c) => /^(url|domain|website|site)$/i.test(c));
      if (urlCol === null && headerIdx !== -1) {
        urlCol = headerIdx; // remember which column holds URLs, then skip this header row
        continue;
      }
      cell = cols[urlCol ?? 0] ?? cols[0];
    }

    const url = normalizeUrl(cell);
    if (url) out.push(url);
  }
  return [...new Set(out)];
}

/** Filesystem-safe slug derived from a URL's host (+ path), e.g. "https://www.A.com/x" -> "a-com-x". */
export function slugify(url) {
  const bare = String(url)
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "");
  return bare.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() || "site";
}

/** Highest-priority fix for a report (critical/high first, then by weight), or undefined. */
export function topFix(report) {
  const fixes = [...(report?.topFixes ?? [])].sort(
    (a, b) => SEV_RANK[a.severity] - SEV_RANK[b.severity] || b.weight - a.weight,
  );
  return fixes[0];
}

/** Build one index.csv row object from a rendered report. */
export function summaryRow(url, report) {
  const score = report?.score ?? {};
  const fix = topFix(report);
  return {
    url,
    score: score.overall ?? "",
    grade: score.grade ?? "",
    pages: report?.pagesCrawled ?? "",
    failed: score.failedCount ?? "",
    critical: score.criticalCount ?? "",
    topFix: fix ? `[${fix.severity}] ${fix.title}` : "",
  };
}

function csvCell(value) {
  const s = String(value ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Serialize summary rows to a CSV string (always includes the header row). */
export function toCsv(rows) {
  const header = CSV_COLUMNS.join(",");
  if (!rows?.length) return `${header}\n`;
  const body = rows.map((r) => CSV_COLUMNS.map((c) => csvCell(r[c])).join(",")).join("\n");
  return `${header}\n${body}\n`;
}
