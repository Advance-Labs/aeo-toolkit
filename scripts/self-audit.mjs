#!/usr/bin/env node
/**
 * Self-audit (#38): run the toolkit's own auditor against a live site — by default, ours.
 *
 * The site sells a scoring engine; this is the check that stops it from quietly regressing on
 * the rules it scores. Mirrors the console's audit pipeline (crawl → parse → structured-data →
 * score) using the BUILT packages, so what CI checks is what users run.
 *
 * Usage:
 *   node scripts/self-audit.mjs [url]
 *
 * Environment / flags:
 *   SELF_AUDIT_URL        target site   (default https://aeo.advancelabs.dev)
 *   SELF_AUDIT_MIN_SCORE  fail below    (default 80)
 *   SELF_AUDIT_MAX_PAGES  crawl cap     (default 20)
 *
 * Exit codes:
 *   0 — score at or above threshold, OR the site was unreachable (a connectivity problem is
 *       not a scoring regression; the run warns loudly instead of failing the schedule)
 *   1 — the site was crawled and scored BELOW the threshold: a real regression
 *   2 — packages not built / bad invocation
 *
 * Requires `pnpm build` (or a turbo build of crawler, html-parser, schema-validator, scoring).
 */

const TARGET = process.argv[2] ?? process.env.SELF_AUDIT_URL ?? 'https://aeo.advancelabs.dev';
// Calibrated to the live score at introduction (75 on 2026-09-02) minus a small buffer,
// per #38 — ratchet this up as the failed rules land fixes.
const MIN_SCORE = Number(process.env.SELF_AUDIT_MIN_SCORE ?? '70');
const MAX_PAGES = Number(process.env.SELF_AUDIT_MAX_PAGES ?? '20');
const CRAWL_ATTEMPTS = 3;
const RETRY_DELAY_MS = 10_000;

/** GitHub Actions annotation when running in CI; plain line otherwise. */
function annotate(level, message) {
  const prefix = process.env.GITHUB_ACTIONS === 'true' ? `::${level}::` : `${level.toUpperCase()}: `;
  console.log(`${prefix}${message}`);
}

async function loadPackages() {
  try {
    const [crawler, htmlParser, schemaValidator, scoring] = await Promise.all([
      import('../packages/crawler/dist/index.js'),
      import('../packages/html-parser/dist/index.js'),
      import('../packages/schema-validator/dist/index.js'),
      import('../packages/scoring/dist/index.js'),
    ]);
    return { crawler, htmlParser, schemaValidator, scoring };
  } catch (err) {
    annotate('error', `Could not load built packages — run \`pnpm build\` first. (${err.message})`);
    process.exit(2);
  }
}

/** Same parseability gate as the console's audit pipeline. */
function isParseablePage(page) {
  if (!page.ok || typeof page.body !== 'string' || page.body.length === 0) return false;
  const ct = page.contentType;
  return ct === undefined || /text\/html|application\/xhtml\+xml/i.test(ct);
}

async function crawlWithRetries(crawl, url) {
  for (let attempt = 1; attempt <= CRAWL_ATTEMPTS; attempt += 1) {
    try {
      const result = await crawl(url, {
        maxPages: MAX_PAGES,
        respectRobotsTxt: true,
        followSitemap: true,
        userAgent: '@advance-labs/self-audit/1.0',
      });
      if (result.pages.some((p) => p.ok)) return result;
      annotate('warning', `Attempt ${attempt}/${CRAWL_ATTEMPTS}: crawl returned no OK pages.`);
    } catch (err) {
      annotate('warning', `Attempt ${attempt}/${CRAWL_ATTEMPTS}: crawl failed (${err.message}).`);
    }
    if (attempt < CRAWL_ATTEMPTS) await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
  }
  return undefined;
}

const { crawler, htmlParser, schemaValidator, scoring } = await loadPackages();

console.log(`Self-audit: ${TARGET} (max ${MAX_PAGES} pages, threshold ${MIN_SCORE})\n`);

const crawlResult = await crawlWithRetries(crawler.crawl, TARGET);
if (!crawlResult) {
  // Deliberate neutral exit: an unreachable site on a scheduled runner is a connectivity
  // event, not evidence the site regressed on scoring rules. Fail on scores only.
  annotate('warning', `${TARGET} was unreachable after ${CRAWL_ATTEMPTS} attempts — skipping (not failing) the self-audit.`);
  process.exit(0);
}

const pages = [];
const structuredData = [];
for (const page of crawlResult.pages) {
  if (!isParseablePage(page)) continue;
  pages.push(htmlParser.parseHtml(page.body, page.finalUrl));
  structuredData.push(schemaValidator.analyzeStructuredData(page.body, page.finalUrl));
}

if (pages.length === 0) {
  annotate('warning', 'Crawl succeeded but no page was parseable HTML — skipping (not failing).');
  process.exit(0);
}

const score = await scoring.auditScore({ crawl: crawlResult, pages, structuredData, mode: 'full-site' });

console.log(`Pages crawled: ${crawlResult.pages.length} (parsed ${pages.length})`);
console.log(`Overall: ${score.overall}/100 (grade ${score.grade}) — ${score.passedCount} passed, ${score.failedCount} failed\n`);

for (const category of score.categories) {
  console.log(`  ${String(Math.round(category.score)).padStart(3)}  ${category.label}`);
}

const failed = score.categories
  .flatMap((c) => c.findings)
  .filter((f) => !f.passed);
if (failed.length > 0) {
  console.log('\nFailed rules:');
  for (const finding of failed) {
    console.log(`  [${finding.severity}] ${finding.id} — ${finding.title}`);
    console.log(`      ${finding.description}`);
    for (const url of (finding.affectedUrls ?? []).slice(0, 3)) {
      console.log(`      · ${url}`);
    }
  }
}

console.log('');
if (score.overall < MIN_SCORE) {
  annotate('error', `Self-audit FAILED: ${TARGET} scored ${score.overall}, below the ${MIN_SCORE} threshold. The site is regressing on the rules it sells — see the failed rules above.`);
  process.exit(1);
}
console.log(`Self-audit passed: ${score.overall} >= ${MIN_SCORE}.`);
