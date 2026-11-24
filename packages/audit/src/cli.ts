import { realpathSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { parseCliArgs, USAGE } from './args.js';
import { runAudit as liveAudit } from './audit.js';
import { exitCodeFor, formatReport } from './format.js';
import type { AuditReport } from '@advance-labs/types';

export interface Io {
  out: (s: string) => void;
  err: (s: string) => void;
  audit: (url: string, pages: number) => Promise<AuditReport>;
}

/** Returns the process exit code. 0 ok, 1 below --fail-under, 2 usage or network error. */
export async function main(argv: string[], io: Io): Promise<number> {
  const args = parseCliArgs(argv);
  if (args.kind === 'help') {
    io.out(USAGE);
    return 0;
  }
  if (args.kind === 'error') {
    io.err(`aeo-audit: ${args.message}\n\n${USAGE}`);
    return 2;
  }
  const { url, pages, json, failUnder } = args.options;
  let report: AuditReport;
  try {
    report = await io.audit(url, pages);
  } catch (err) {
    io.err(`aeo-audit: ${(err as Error).message}`);
    return 2;
  }
  io.out(json ? JSON.stringify(report, null, 2) : formatReport(report));
  const code = exitCodeFor(report.score.overall, failUnder);
  if (code === 1) io.err(`aeo-audit: score ${report.score.overall} is below --fail-under ${failUnder}`);
  return code;
}

// realpath: npx runs this through a node_modules/.bin symlink.
if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  main(process.argv.slice(2), {
    out: (s) => process.stdout.write(`${s}\n`),
    err: (s) => console.error(s),
    audit: liveAudit,
  }).then((code) => {
    process.exitCode = code;
  });
}
