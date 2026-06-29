/**
 * /api/orchestrator/run — the Autopilot cadence trigger. Runs one cadence pass per managed customer,
 * each hard-scoped to that customer (security C2: runCadence only ever gets one profile and writes its
 * own ownerId). Writes everything `pending` — it never auto-publishes here (publish-on-approve lives
 * in the inbox decision route). Inert-when-dormant (M1): 404s without the managed env.
 *
 * Two authenticated entry points:
 *  - GET  — Vercel Cron (see vercel.json). Authorized by `Authorization: Bearer ${CRON_SECRET}`,
 *           the same convention as the blogging cron.
 *  - POST — external/manual worker. Authorized by the constant-time `x-orchestrator-secret` (H1).
 */
import { NextResponse } from 'next/server';
import { runCadence, type SupabaseLike } from '@aeo/orchestrator';
import { createManagedTokenStore } from '@aeo/storage';
import { verifyJobSecret } from '@/lib/managed/jobSecret';
import { managedEnabled } from '@/lib/managed/staff';
import { buildDepsForCustomer, managedModelsFromEnv } from '@/lib/managed/deps';
import { createServiceClient, loadCustomerProfiles, recordManagedJob } from '@/lib/managed/data';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/** Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`; require an exact match. */
function cronAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (secret === undefined || secret.length === 0) return false;
  return req.headers.get('authorization') === `Bearer ${secret}`;
}

/** Run one cadence pass for every managed customer. Shared by the GET (cron) and POST (manual) paths. */
async function runAllDueCustomers(): Promise<Response> {
  const client = createServiceClient();
  const models = managedModelsFromEnv();
  if (client === null || models === null) {
    return NextResponse.json({ error: 'Managed tier not fully configured.' }, { status: 503 });
  }

  const tokenStore = createManagedTokenStore(client, {
    encryptionKey: process.env.TOKEN_ENCRYPTION_KEY,
  });
  const customers = await loadCustomerProfiles(client);

  const results: Array<{ customerId: string; jobs?: unknown; error?: string }> = [];
  for (const customer of customers) {
    try {
      const tokens = await tokenStore.get(customer.ownerId, 'google');
      const deps = buildDepsForCustomer({
        client: client as unknown as SupabaseLike,
        googleAccessToken: tokens?.accessToken ?? '',
        models,
      });
      const jobs = await runCadence(customer, deps);
      for (const job of jobs) {
        if (!job.skipped) await recordManagedJob(client, customer.ownerId, job);
      }
      results.push({ customerId: customer.id, jobs });
    } catch (err) {
      // One customer's failure must not abort the whole pass.
      results.push({ customerId: customer.id, error: (err as Error).message });
    }
  }

  return NextResponse.json({ ran: results.length, results });
}

/** Vercel Cron entry point. */
export async function GET(req: Request): Promise<Response> {
  if (!managedEnabled() || !cronAuthorized(req)) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  }
  return runAllDueCustomers();
}

/** External/manual worker entry point (H1 job secret). */
export async function POST(req: Request): Promise<Response> {
  if (!managedEnabled() || !verifyJobSecret(req)) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  }
  return runAllDueCustomers();
}
