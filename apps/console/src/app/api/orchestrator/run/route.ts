/**
 * POST /api/orchestrator/run — the out-of-band Autopilot cadence trigger.
 *
 * Driven by a cron/worker, NOT a user session. Authenticated by a constant-time job secret (security
 * H1). Runs one cadence pass per managed customer, scoped to that customer (security C2: runCadence
 * only ever gets one profile and writes the profile's own ownerId). Writes everything `pending` — it
 * never auto-publishes here (publish-on-approve lives in the inbox decision route).
 *
 * Inert-when-dormant (M1): without the managed env it 404s like any unknown route.
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

export async function POST(req: Request): Promise<Response> {
  // H1 + M1: closed unless the tier is enabled AND the job secret matches.
  if (!managedEnabled() || !verifyJobSecret(req)) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  }

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
