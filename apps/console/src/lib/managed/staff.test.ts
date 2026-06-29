import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { isStaff } from './staff.js';

describe('isStaff', () => {
  const prev = process.env.STAFF_EMAILS;
  beforeEach(() => {
    process.env.STAFF_EMAILS = ' Ops@Advancelabs.dev , lead@advancelabs.dev ';
  });
  afterEach(() => {
    process.env.STAFF_EMAILS = prev;
  });

  it('is false for null/undefined/empty email', () => {
    expect(isStaff(null)).toBe(false);
    expect(isStaff(undefined)).toBe(false);
    expect(isStaff('')).toBe(false);
  });

  it('is false for an email not in the allowlist', () => {
    expect(isStaff('stranger@example.com')).toBe(false);
  });

  it('matches the allowlist case-insensitively and trimmed', () => {
    expect(isStaff('ops@advancelabs.dev')).toBe(true);
    expect(isStaff('  LEAD@ADVANCELABS.DEV ')).toBe(true);
  });

  it('is false when no allowlist is configured', () => {
    delete process.env.STAFF_EMAILS;
    expect(isStaff('ops@advancelabs.dev')).toBe(false);
  });
});
