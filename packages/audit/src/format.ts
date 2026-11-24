import type { AuditReport, Finding } from '@advance-labs/types';

export const REPORT_URL = 'https://advancelabs.dev/tools/audit';
// ponytail: /tools/audit takes no ?url= param yet, so the link carries only UTM tags.
export const FULL_REPORT_LINK = `${REPORT_URL}?utm_source=npm&utm_medium=cli`;

/** First sentence of a recommendation, capped so it stays on one terminal line. */
export function oneLine(text: string, max = 110): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  const sentence = flat.match(/^.*?[.!?](?=\s|$)/)?.[0] ?? flat;
  return sentence.length > max ? `${sentence.slice(0, max - 3).trimEnd()}...` : sentence;
}

const bar = (score: number): string => {
  const filled = Math.round(score / 10);
  return '#'.repeat(filled) + '.'.repeat(10 - filled);
};

function fixLine(f: Finding, i: number): string[] {
  return [`  ${i + 1}. [${f.severity}] ${f.title}`, `     Fix: ${oneLine(f.recommendation)}`];
}

export function formatReport(report: AuditReport): string {
  const { score } = report;
  const pageWord = report.pagesCrawled === 1 ? 'page' : 'pages';
  const labelWidth = Math.max(...score.categories.map((c) => c.label.length));
  const lines = [
    `AEO/SEO audit: ${report.url}`,
    `${report.pagesCrawled} ${pageWord} crawled`,
    '',
    `Overall score: ${Math.round(score.overall)}/100 (grade ${score.grade})`,
    `${score.passedCount} checks passed, ${score.failedCount} failed, ${score.criticalCount} critical`,
    '',
    'Categories',
    ...score.categories.map((c) => {
      const pts = Math.round(c.score);
      return `  ${c.label.padEnd(labelWidth)} ${bar(pts)} ${String(pts).padStart(3)}/100`;
    }),
    '',
  ];
  const top = report.topFixes.slice(0, 5);
  if (top.length === 0) lines.push('No failing checks.');
  else lines.push(`Top ${top.length} fixes`, ...top.flatMap(fixLine));
  lines.push('', `Full report with fix templates: ${FULL_REPORT_LINK}`);
  return lines.join('\n');
}

/** Exit 1 when a threshold is set and the score is below it. */
export function exitCodeFor(score: number, failUnder: number | undefined): 0 | 1 {
  return failUnder !== undefined && score < failUnder ? 1 : 0;
}
