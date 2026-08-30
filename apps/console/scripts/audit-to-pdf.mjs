/**
 * audit-to-pdf.mjs — crawl + score a live site and export the co-branded @advance-labs/pdf report.
 * Usage: node scripts/audit-to-pdf.mjs --site https://advancelabs.dev --max 25 --out <file.pdf>
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { auditSite, ENGINE_VERSION } from "./lib/audit-site.mjs";
import { renderAuditReportPdf } from "@advance-labs/pdf";

const argv = process.argv.slice(2);
const args = { site: "https://advancelabs.dev", max: 25, out: "advancelabs-audit.pdf" };
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === "--site") args.site = argv[++i];
  else if (argv[i] === "--max") args.max = Number(argv[++i]) || 25;
  else if (argv[i] === "--out") args.out = argv[++i];
}

process.stderr.write(`Crawling ${args.site} (max ${args.max} pages)…\n`);
const report = await auditSite(args.site, { max: args.max, version: ENGINE_VERSION });
const bytes = await renderAuditReportPdf(report);
const out = resolve(args.out);
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, bytes);
const s = report.score;
process.stderr.write(
  `Score ${s.overall}/100 (${s.grade}) · ${report.pagesCrawled} pages · ` +
  `${s.passedCount} passed / ${s.failedCount} failed / ${s.criticalCount} critical · ${report.topFixes.length} fixes\n`,
);
process.stderr.write(`PDF written: ${out} (${bytes.length} bytes)\n`);
