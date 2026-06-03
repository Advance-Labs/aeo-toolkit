/**
 * GET /api/chat/connection — report whether the current browser session is connected to Google, and
 * if so, list the GSC sites and GA4 properties the token can access for the pickers.
 *
 * GA4 property listing is a stub in `@aeo/google-api` (returns `[]` until the Admin API is wired),
 * so the UI falls back to manual property-id entry. GSC `listSites()` is live. Node runtime only.
 */
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { Ga4Client, GscClient } from '@aeo/google-api';
import type { Ga4Property, GscSite } from '@aeo/types';
import { getValidAccessToken, USER_COOKIE } from '@/lib/oauth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface ConnectionResponse {
  connected: boolean;
  sites: GscSite[];
  properties: Ga4Property[];
}

export async function GET(): Promise<NextResponse<ConnectionResponse>> {
  const cookieStore = await cookies();
  const userId = cookieStore.get(USER_COOKIE)?.value;

  if (!userId) {
    return NextResponse.json({ connected: false, sites: [], properties: [] });
  }

  const accessToken = await getValidAccessToken(userId).catch(() => null);
  if (accessToken === null) {
    return NextResponse.json({ connected: false, sites: [], properties: [] });
  }

  const gsc = new GscClient({ accessToken });
  const ga4 = new Ga4Client({ accessToken });

  // listProperties() is a typed stub (returns []) — surfaced so the UI can show manual entry.
  const [sites, properties] = await Promise.all([
    gsc.listSites().catch(() => [] as GscSite[]),
    ga4.listProperties().catch(() => [] as Ga4Property[]),
  ]);

  return NextResponse.json({ connected: true, sites, properties });
}
