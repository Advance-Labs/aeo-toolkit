import { describe, expect, it } from 'vitest';
import { exitCodeFor, formatReport, oneLine } from './format.js';
import { fakeReport } from './fixtures.js';

describe('formatReport', () => {
  const out = formatReport(fakeReport());

  it('shows score, grade, categories and exactly 5 fixes', () => {
    expect(out).toContain('Overall score: 72/100 (grade C)');
    expect(out).toContain('AEO');
    expect(out).toContain('Metadata');
    expect(out).toContain('Top 5 fixes');
    expect(out).toContain('5. [medium] Rule e');
    expect(out).not.toContain('Rule f');
  });

  it('keeps one-line fixes and ends with the report link', () => {
    expect(out).toContain('Fix: Do thing a.');
    expect(out).not.toContain('more detail');
    expect(out.split('\n').at(-1)).toBe(
      'Full report with fix templates: https://advancelabs.dev/tools/audit?utm_source=npm&utm_medium=cli',
    );
  });

  it('has no em dashes', () => {
    expect(out).not.toContain('—');
  });
});

describe('oneLine', () => {
  it('truncates long text', () => {
    expect(oneLine('x'.repeat(300)).length).toBe(110);
  });
});

describe('exitCodeFor', () => {
  it('fails only below the threshold', () => {
    expect(exitCodeFor(79, 80)).toBe(1);
    expect(exitCodeFor(80, 80)).toBe(0);
    expect(exitCodeFor(0, undefined)).toBe(0);
  });
});
