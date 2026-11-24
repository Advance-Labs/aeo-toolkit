import { parseArgs } from 'node:util';

export const DEFAULT_PAGES = 10;
export const MAX_PAGES = 50;

export interface Options {
  url: string;
  pages: number;
  json: boolean;
  failUnder: number | undefined;
}

export type ParsedArgs = { kind: 'run'; options: Options } | { kind: 'help' } | { kind: 'error'; message: string };

export const USAGE = `Usage: aeo-audit <url-or-domain> [options]

Options:
  --pages <n>          Pages to crawl (default ${DEFAULT_PAGES}, max ${MAX_PAGES})
  --json               Print the full machine-readable report as JSON
  --fail-under <score> Exit 1 if the overall score is below <score> (0-100)
  -h, --help           Show this help

Example: npx @advance-labs/audit example.com --pages 5`;

/** Accept `example.com` or a full URL. Only http(s) is allowed. */
export function normalizeUrl(input: string): string | undefined {
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(input) ? input : `https://${input}`;
  try {
    const u = new URL(withScheme);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.toString() : undefined;
  } catch {
    return undefined;
  }
}

function intInRange(raw: string, min: number, max: number): number | undefined {
  if (!/^\d+$/.test(raw)) return undefined;
  const n = Number(raw);
  return n >= min && n <= max ? n : undefined;
}

export function parseCliArgs(argv: string[]): ParsedArgs {
  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        pages: { type: 'string' },
        json: { type: 'boolean', default: false },
        'fail-under': { type: 'string' },
        help: { type: 'boolean', short: 'h', default: false },
      },
    });
  } catch (err) {
    return { kind: 'error', message: (err as Error).message };
  }
  const { values, positionals } = parsed;
  if (values.help) return { kind: 'help' };
  if (positionals.length !== 1) return { kind: 'error', message: 'Expected exactly one URL or domain.' };

  const url = normalizeUrl(positionals[0]!);
  if (!url) return { kind: 'error', message: `Not a valid http(s) URL or domain: ${positionals[0]}` };

  let pages = DEFAULT_PAGES;
  if (values.pages !== undefined) {
    const n = intInRange(values.pages, 1, MAX_PAGES);
    if (n === undefined) return { kind: 'error', message: `--pages must be a whole number from 1 to ${MAX_PAGES}.` };
    pages = n;
  }

  let failUnder: number | undefined;
  if (values['fail-under'] !== undefined) {
    failUnder = intInRange(values['fail-under'], 0, 100);
    if (failUnder === undefined) return { kind: 'error', message: '--fail-under must be a whole number from 0 to 100.' };
  }

  return { kind: 'run', options: { url, pages, json: values.json, failUnder } };
}
