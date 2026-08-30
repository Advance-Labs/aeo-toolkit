/**
 * run-lead-audit.mjs — one-off runner: audit a lead's site with the real scoring engine
 * and render the branded Advance Labs PDF (same pipeline as /api/audit/technical/pdf).
 *
 * Usage: node scripts/run-lead-audit.mjs --site https://example.com --out /path/out.pdf
 */
import { writeFileSync } from "node:fs";
import { auditSite, ENGINE_VERSION } from "./lib/audit-site.mjs";
import { renderAuditReportPdf } from "@advance-labs/pdf";

function parseArgs(argv) {
  const args = { site: null, max: 25, out: "audit.pdf" };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--site") args.site = argv[++i];
    else if (a === "--max") args.max = Number(argv[++i]) || 25;
    else if (a === "--out") args.out = argv[++i];
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.site) {
    process.stderr.write("Usage: node scripts/run-lead-audit.mjs --site <url> --out <file.pdf>\n");
    process.exit(1);
  }
  process.stderr.write(`Crawling ${args.site} (max ${args.max} pages)…\n`);
  const report = await auditSite(args.site, { max: args.max, version: ENGINE_VERSION });
  process.stderr.write(`Score: ${report.score.overall}/100 (${report.score.grade}) — pages crawled: ${report.pagesCrawled}\n`);
  const bytes = await renderAuditReportPdf(report);
  writeFileSync(args.out, bytes);
  process.stderr.write(`PDF written: ${args.out}\n`);
}

main().catch((err) => {
  process.stderr.write(`Error: ${err?.stack || err}\n`);
  process.exit(1);
});
