/**
 * Per-proposal authorization (security C2).
 *
 * The approval inbox mutates/executes through a SERVICE-ROLE client, which bypasses RLS. So RLS is NOT
 * the authorization control here — this function is. Every inbox decision MUST call `assertCanDecide`
 * and refuse on a non-ok result before any service-role write.
 */
import { isStaff } from './staff.js';

export interface DecideUser {
  id: string;
  email?: string | null;
}

export type DecideResult = { ok: true } | { ok: false; status: 401 | 403; error: string };

/**
 * Decide whether `user` may approve/reject/execute `proposal`. Allowed iff the user is staff OR owns
 * the proposal. Anonymous → 401; authenticated-but-unauthorized → 403 (cross-tenant block).
 */
export function assertCanDecide(proposal: { ownerId: string }, user: DecideUser | null): DecideResult {
  if (!user) {
    return { ok: false, status: 401, error: 'Sign in required.' };
  }
  if (isStaff(user.email) || proposal.ownerId === user.id) {
    return { ok: true };
  }
  return { ok: false, status: 403, error: 'Not authorized for this proposal.' };
}
