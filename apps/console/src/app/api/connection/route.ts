/**
 * GET /api/connection — report whether Google (GA4 + Search Console) is connected for this browser,
 * and if so, the user's available properties + sites. Always returns 200 with a graceful
 * `{ connected: false }` when there is no session, no token, or Google OAuth is not configured —
 * never a 4xx/5xx, so the client connection check is noise-free.
 */
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { Ga4Client, GscClient } from '@advance-labs/google-api';
import type { ConnectionResponse } from '@/components/chat/chat-types';
import { getValidAccessToken, USER_COOKIE } from '@/lib/oauth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DISCONNECTED: ConnectionResponse = { connected: false, sites: [], properties: [] };

export async function GET(): Promise<NextResponse> {
  try {
    const userId = (await cookies()).get(USER_COOKIE)?.value;
    if (userId === undefined) return NextResponse.json(DISCONNECTED);

    const accessToken = await getValidAccessToken(userId);
    if (accessToken === null) return NextResponse.json(DISCONNECTED);

    const [sites, properties] = await Promise.all([
      new GscClient({ accessToken }).listSites().catch(() => []),
      new Ga4Client({ accessToken }).listProperties().catch(() => []),
    ]);
    const body: ConnectionResponse = { connected: true, sites, properties };
    return NextResponse.json(body);
  } catch {
    return NextResponse.json(DISCONNECTED);
  }
}
