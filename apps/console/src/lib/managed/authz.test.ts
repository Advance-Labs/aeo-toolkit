import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { assertCanDecide } from './authz.js';

const proposal = { ownerId: 'owner-1' };

describe('assertCanDecide (security C2)', () => {
  const prev = process.env.STAFF_EMAILS;
  beforeEach(() => {
    process.env.STAFF_EMAILS = 'ops@advancelabs.dev';
  });
  afterEach(() => {
    process.env.STAFF_EMAILS = prev;
  });

  it('denies an unauthenticated caller with 401', () => {
    const r = assertCanDecide(proposal, null);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(401);
  });

  it('allows the proposal owner', () => {
    expect(assertCanDecide(proposal, { id: 'owner-1', email: 'someone@else.com' }).ok).toBe(true);
  });

  it('allows a staff member acting on someone else’s proposal', () => {
    expect(assertCanDecide(proposal, { id: 'other', email: 'ops@advancelabs.dev' }).ok).toBe(true);
  });

  it('denies a non-owner, non-staff caller with 403 (cross-tenant block)', () => {
    const r = assertCanDecide(proposal, { id: 'attacker', email: 'attacker@evil.com' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(403);
  });
});
