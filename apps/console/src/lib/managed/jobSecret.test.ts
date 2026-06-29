import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { verifyJobSecret } from './jobSecret.js';

const HEADER = 'x-orchestrator-secret';

function reqWith(secret?: string): Request {
  const headers = new Headers();
  if (secret !== undefined) headers.set(HEADER, secret);
  return new Request('https://aeo.test/api/orchestrator/run', { method: 'POST', headers });
}

describe('verifyJobSecret (security H1)', () => {
  const prev = process.env.ORCHESTRATOR_JOB_SECRET;
  beforeEach(() => {
    process.env.ORCHESTRATOR_JOB_SECRET = 'super-secret-value';
  });
  afterEach(() => {
    process.env.ORCHESTRATOR_JOB_SECRET = prev;
  });

  it('accepts the correct secret', () => {
    expect(verifyJobSecret(reqWith('super-secret-value'))).toBe(true);
  });

  it('rejects a wrong secret', () => {
    expect(verifyJobSecret(reqWith('nope'))).toBe(false);
  });

  it('rejects a missing header', () => {
    expect(verifyJobSecret(reqWith(undefined))).toBe(false);
  });

  it('rejects everything when no secret is configured (dormant = closed)', () => {
    delete process.env.ORCHESTRATOR_JOB_SECRET;
    expect(verifyJobSecret(reqWith('super-secret-value'))).toBe(false);
  });
});
