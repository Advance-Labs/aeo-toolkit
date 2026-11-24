import { describe, expect, it, vi } from 'vitest';
import { main, type Io } from './cli.js';
import { fakeReport } from './fixtures.js';

function run(argv: string[], audit: Io['audit']) {
  const out: string[] = [];
  const err: string[] = [];
  const done = main(argv, { out: (s) => out.push(s), err: (s) => err.push(s), audit });
  return done.then((code) => ({ code, out: out.join('\n'), err: err.join('\n') }));
}

describe('main', () => {
  it('prints the report and exits 0', async () => {
    const audit = vi.fn(async () => fakeReport(90));
    const r = await run(['example.com', '--pages', '3'], audit);
    expect(audit).toHaveBeenCalledWith('https://example.com/', 3);
    expect(r.code).toBe(0);
    expect(r.out).toContain('90/100');
  });

  it('--json prints parseable JSON only', async () => {
    const r = await run(['example.com', '--json'], async () => fakeReport());
    expect(JSON.parse(r.out).score.overall).toBe(72);
  });

  it('--fail-under exits 1 below threshold, still prints the report', async () => {
    const r = await run(['example.com', '--fail-under', '80'], async () => fakeReport(72));
    expect(r.code).toBe(1);
    expect(r.out).toContain('72/100');
    expect(r.err).toContain('below --fail-under 80');
  });

  it('--fail-under passes at or above threshold', async () => {
    expect((await run(['example.com', '--fail-under', '72'], async () => fakeReport(72))).code).toBe(0);
  });

  it('network errors exit 2 with a clear message and no stdout', async () => {
    const r = await run(['example.com'], async () => {
      throw new Error('Could not fetch https://example.com/ (no response)');
    });
    expect(r.code).toBe(2);
    expect(r.err).toContain('Could not fetch');
    expect(r.out).toBe('');
  });

  it('usage errors exit 2 and never audit', async () => {
    const audit = vi.fn();
    const r = await run(['--pages', '99', 'a.com'], audit);
    expect(r.code).toBe(2);
    expect(audit).not.toHaveBeenCalled();
  });
});
