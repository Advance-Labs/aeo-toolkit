/**
 * seo-audit-batch.mjs — run the Advance Labs AEO scoring engine across a LIST of sites and render a
 * one-page PDF "scorecard" per site via @advance-labs/pdf. This is the outreach-hook generator: feed it a
 * target list, get back N branded PDF scorecards plus an index.csv ranking them by score, so the
 * worst-scoring (best-prospect) sites float to the top of the cold-email queue.
 *
 * Lives in apps/console because @advance-labs/* workspace packages resolve from here (pnpm symlinks in
 * apps/console/node_modules). Run it from this directory.
 *
 * Usage:
 *   node scripts/seo-audit-batch.mjs --targets scripts/targets/london-smb.txt --out out/scorecards \
 *     --limit 15 --max 12 --concurrency 3
 *
 * Flags:
 *   --targets <file>   (required) list of URLs/domains; `#` comments + blank lines ignored; CSV ok
 *   --out <dir>        output directory for the PDFs + index.csv  (default: out/scorecards)
 *   --limit <n>        cap the number of sites audited                       (default: 15, 0 = all)
 *   --max <pages>      max pages crawled per site                             (default: 12)
 *   --concurrency <n>  how many sites to audit in parallel                    (default: 3)
 *   --force            re-render even if a scorecard PDF already exists       (default: skip)
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { renderAuditReportPdf } from "@advance-labs/pdf";
import { auditSite, ENGINE_VERSION } from "./lib/audit-site.mjs";
import { parseTargets, slugify, summaryRow, toCsv } from "./lib/batch-core.mjs";

function parseArgs(argv) {
  const args = { targets: null, out: "out/scorecards", limit: 15, max: 12, concurrency: 3, force: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--targets") args.targets = argv[++i];
    else if (a === "--out") args.out = argv[++i];
    else if (a === "--limit") args.limit = Number(argv[++i]) ?? args.limit;
    else if (a === "--max") args.max = Number(argv[++i]) || args.max;
    else if (a === "--concurrency") args.concurrency = Number(argv[++i]) || args.concurrency;
    else if (a === "--force") args.force = true;
  }
  return args;
}

const log = (m) => process.stderr.write(`${m}\n`);

/** Bounded-concurrency map: run `worker` over `items`, at most `concurrency` in flight. */
async function runPool(items, concurrency, worker) {
  const results = new Array(items.length);
  let next = 0;
  async function pull() {
    while (next < items.length) {
      const i = next++;
      results[i] = await worker(items[i], i);
    }
  }
  const lanes = Math.max(1, Math.min(concurrency, items.length));
  await Promise.all(Array.from({ length: lanes }, pull));
  return results;
}

/** A row used when a site is skipped or fails — keeps index.csv complete without a real score. */
const stubRow = (url, topFix) => ({ url, score: "", grade: "", pages: "", failed: "", critical: "", topFix });

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.targets) {
    log("error: --targets <file> is required");
    process.exit(2);
  }

  const targetsPath = resolve(args.targets);
  if (!existsSync(targetsPath)) {
    log(`error: targets file not found: ${targetsPath}`);
    process.exit(2);
  }

  let targets = parseTargets(readFileSync(targetsPath, "utf8"));
  if (targets.length === 0) {
    log(`error: no usable targets parsed from ${targetsPath}`);
    process.exit(2);
  }
  if (args.limit > 0) targets = targets.slice(0, args.limit);

  const outDir = resolve(args.out);
  mkdirSync(outDir, { recursive: true });
  log(
    `Generating ${targets.length} scorecard(s) → ${outDir} ` +
      `(≤${args.max} pages/site, concurrency ${args.concurrency}, engine v${ENGINE_VERSION})`,
  );

  const rows = await runPool(targets, args.concurrency, async (url, i) => {
    const tag = `[${i + 1}/${targets.length}] ${url}`;
    const pdfPath = join(outDir, `${slugify(url)}.pdf`);

    if (!args.force && existsSync(pdfPath)) {
      log(`${tag} — skip (already generated)`);
      return stubRow(url, "(skipped — already generated)");
    }

    try {
      log(`${tag} — auditing…`);
      const report = await auditSite(url, { max: args.max, version: ENGINE_VERSION });
      writeFileSync(pdfPath, await renderAuditReportPdf(report));
      const row = summaryRow(url, report);
      log(`${tag} — ${row.score}/100 (${row.grade}) → ${slugify(url)}.pdf`);
      return row;
    } catch (err) {
      const msg = err?.message || String(err);
      log(`${tag} — FAILED: ${msg}`);
      return stubRow(url, `ERROR: ${msg}`);
    }
  });

  // Rank by score descending; blanks (skipped/failed) sink to the bottom.
  const ranked = [...rows].sort((a, b) => (Number(b.score) || -1) - (Number(a.score) || -1));
  const csvPath = join(outDir, "index.csv");
  writeFileSync(csvPath, toCsv(ranked), "utf8");

  const ok = rows.filter((r) => r.score !== "").length;
  log(`\nDone: ${ok}/${targets.length} scorecards generated. Index: ${csvPath}`);
  if (ok === 0) process.exit(1);
}

main().catch((err) => {
  process.stderr.write(`Batch failed: ${err?.message || err}\n`);
  process.exit(1);
});
