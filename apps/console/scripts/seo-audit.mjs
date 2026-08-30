/**
 * seo-audit.mjs — run the Advance Labs AEO Toolkit scoring engine against a live site
 * and write a dated markdown report. This is the "investigate" half of the repeatable
 * SEO/AEO cycle, automated: crawl -> parse -> structured-data -> score (40+ technical-SEO,
 * AEO, and E-E-A-T rules) -> prioritized P0/P1/P2 fix list.
 *
 * Lives in apps/console because @advance-labs/* workspace packages resolve from here (pnpm
 * symlinks in apps/console/node_modules). Run it from this directory.
 *
 * Usage:
 *   node scripts/seo-audit.mjs --site https://advancelabs.dev --max 25 --out <dir>
 *   # --out omitted -> prints the report to stdout
 *
 * Example (writing into the advance-labs repo):
 *   cd aeo-toolkit/apps/console
 *   node scripts/seo-audit.mjs --site https://advancelabs.dev \
 *     --out ../../../advance-labs/docs/seo/audits
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { auditSite, ENGINE_VERSION as VERSION } from "./lib/audit-site.mjs";

function parseArgs(argv) {
  const args = { site: "https://advancelabs.dev", max: 25, out: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--site") args.site = argv[++i];
    else if (a === "--max") args.max = Number(argv[++i]) || 25;
    else if (a === "--out") args.out = argv[++i];
  }
  return args;
}

const SEV_RANK = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
const bucket = (sev) =>
  sev === "critical" || sev === "high" ? "P0/P1" : sev === "medium" ? "P2" : "P3";

function toMarkdown(report, site) {
  const d = new Date().toISOString().slice(0, 10);
  const { score } = report;
  const lines = [];
  lines.push(`# AEO + SEO audit — ${site}`);
  lines.push("");
  lines.push(`- **Date:** ${d}`);
  lines.push(`- **Overall score:** ${score.overall}/100 (grade ${score.grade})`);
  lines.push(`- **Pages crawled:** ${report.pagesCrawled}`);
  lines.push(`- **Passed / failed:** ${score.passedCount} / ${score.failedCount} (critical: ${score.criticalCount})`);
  lines.push(`- **Engine:** @advance-labs/scoring v${VERSION}`);
  lines.push("");

  lines.push(`## Category scores`);
  lines.push("");
  lines.push(`| Category | Score | Passed | Failed |`);
  lines.push(`|---|---|---|---|`);
  for (const c of score.categories) {
    lines.push(`| ${c.label} | ${c.score}/100 | ${c.passedCount} | ${c.failedCount} |`);
  }
  lines.push("");

  // Prioritized fixes.
  const fixes = [...report.topFixes].sort(
    (a, b) => (SEV_RANK[a.severity] - SEV_RANK[b.severity]) || (b.weight - a.weight),
  );
  lines.push(`## Prioritized fixes (${fixes.length})`);
  lines.push("");
  if (fixes.length === 0) {
    lines.push(`No failing findings. Site passes every scored rule. ✅`);
  } else {
    let lastBucket = null;
    for (const f of fixes) {
      const b = bucket(f.severity);
      if (b !== lastBucket) {
        lines.push(`### ${b}`);
        lines.push("");
        lastBucket = b;
      }
      lines.push(`- **[${f.id}] ${f.title}** _(${f.severity}, weight ${f.weight}, ${f.category})_`);
      if (f.description) lines.push(`  - ${f.description}`);
      if (f.recommendation) lines.push(`  - **Fix:** ${f.recommendation}`);
      if (f.affectedUrls?.length) lines.push(`  - Affected: ${f.affectedUrls.slice(0, 5).join(", ")}`);
      lines.push("");
    }
  }

  return lines.join("\n") + "\n";
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  process.stderr.write(`Crawling ${args.site} (max ${args.max} pages)…\n`);

  const report = await auditSite(args.site, { max: args.max, version: VERSION });
  const md = toMarkdown(report, args.site);

  if (args.out) {
    const dir = resolve(args.out);
    mkdirSync(dir, { recursive: true });
    const file = join(dir, `${new Date().toISOString().slice(0, 10)}.md`);
    writeFileSync(file, md, "utf8");
    process.stderr.write(`Report written: ${file}\n`);
    process.stderr.write(`Overall: ${report.score.overall}/100 (${report.score.grade}), ${report.topFixes.length} fixes.\n`);
  } else {
    process.stdout.write(md);
  }
}

main().catch((err) => {
  process.stderr.write(`Audit failed: ${err?.message || err}\n`);
  process.exit(1);
});
