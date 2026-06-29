/**
 * Orchestrator trigger authentication (security H1).
 *
 * The scheduled orchestrator run is driven out-of-band (a cron/worker), not by a user session. It is
 * gated by a dedicated shared secret compared in constant time — distinct from the Stripe webhook
 * secret. When the secret is unset the endpoint is closed (dormant).
 */
import { timingSafeEqual } from 'node:crypto';

const HEADER = 'x-orchestrator-secret';

/** Constant-time check of the request's job-secret header against `ORCHESTRATOR_JOB_SECRET`. */
export function verifyJobSecret(req: Request): boolean {
  const expected = process.env.ORCHESTRATOR_JOB_SECRET;
  if (!expected) return false; // dormant → closed
  const got = req.headers.get(HEADER);
  if (!got) return false;
  const a = Buffer.from(got);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false; // timingSafeEqual requires equal lengths
  return timingSafeEqual(a, b);
}
