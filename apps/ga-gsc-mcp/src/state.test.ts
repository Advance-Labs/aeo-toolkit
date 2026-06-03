import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { InvalidStateError, signState, STATE_TTL_MS, verifyState } from './state.js';

const SECRET = 'unit-test-state-secret';
/** A second env bag with a different secret to prove cross-secret rejection. */
const OTHER_ENV = { OAUTH_STATE_SECRET: 'a-different-secret' } satisfies NodeJS.ProcessEnv;

beforeEach(() => {
  process.env.OAUTH_STATE_SECRET = SECRET;
});

afterEach(() => {
  delete process.env.OAUTH_STATE_SECRET;
});

describe('signState / verifyState', () => {
  it('round-trips a user id through sign + verify', () => {
    const state = signState('user-123', 1_000_000);
    expect(verifyState(state, 1_000_000)).toBe('user-123');
  });

  it('round-trips user ids containing dots and unicode', () => {
    const id = 'tenant.42|ünïcödé';
    const state = signState(id, 5_000);
    expect(verifyState(state, 5_000)).toBe(id);
  });

  it('encodes three dot-separated parts and does not leak the raw user id', () => {
    const state = signState('plain-user', 0);
    expect(state.split('.')).toHaveLength(3);
    expect(state).not.toContain('plain-user');
  });

  it('accepts a state within the TTL window', () => {
    const issuedAt = 2_000_000;
    const state = signState('u', issuedAt);
    expect(verifyState(state, issuedAt + STATE_TTL_MS - 1)).toBe('u');
  });

  it('rejects an expired state (older than the TTL)', () => {
    const issuedAt = 2_000_000;
    const state = signState('u', issuedAt);
    expect(() => verifyState(state, issuedAt + STATE_TTL_MS + 1)).toThrow(InvalidStateError);
    expect(() => verifyState(state, issuedAt + STATE_TTL_MS + 1)).toThrow(/expired/i);
  });

  it('rejects a state timestamped far in the future', () => {
    const issuedAt = 10_000_000;
    const state = signState('u', issuedAt);
    expect(() => verifyState(state, issuedAt - STATE_TTL_MS - 1)).toThrow(/future/i);
  });

  it('rejects a tampered signature', () => {
    const state = signState('u', 0);
    const parts = state.split('.');
    const tampered = `${parts[0]}.${parts[1]}.${parts[2]}AAAA`;
    expect(() => verifyState(tampered, 0)).toThrow(/signature/i);
  });

  it('rejects a tampered user-id segment (signature no longer matches)', () => {
    const state = signState('u', 0);
    const parts = state.split('.');
    const forgedUser = Buffer.from('attacker', 'utf8').toString('base64url');
    const tampered = `${forgedUser}.${parts[1]}.${parts[2]}`;
    expect(() => verifyState(tampered, 0)).toThrow(/signature/i);
  });

  it('rejects a tampered timestamp segment (signature no longer matches)', () => {
    const state = signState('u', 1_000);
    const parts = state.split('.');
    const tampered = `${parts[0]}.999999.${parts[2]}`;
    expect(() => verifyState(tampered, 1_000)).toThrow(/signature/i);
  });

  it('rejects a malformed state with the wrong number of parts', () => {
    expect(() => verifyState('only.two', 0)).toThrow(/malformed/i);
    expect(() => verifyState('a.b.c.d', 0)).toThrow(/malformed/i);
    expect(() => verifyState('', 0)).toThrow(/malformed/i);
  });

  it('rejects a state signed with a different secret', () => {
    const foreign = signState('u', 0, OTHER_ENV);
    expect(() => verifyState(foreign, 0)).toThrow(/signature/i);
  });

  it('throws when OAUTH_STATE_SECRET is unset', () => {
    delete process.env.OAUTH_STATE_SECRET;
    expect(() => signState('u', 0)).toThrow(InvalidStateError);
    expect(() => verifyState('a.b.c', 0)).toThrow(/OAUTH_STATE_SECRET/);
  });

  it('refuses to sign an empty user id', () => {
    expect(() => signState('', 0)).toThrow(/empty user id/i);
  });
});
