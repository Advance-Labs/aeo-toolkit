/**
 * Vercel Cron endpoint that pings IndexNow with this site's sitemap URLs.
 *
 * IndexNow lets participating engines (Bing, Yandex) re-crawl changed pages within minutes
 * instead of waiting for a scheduled sitemap read. Google does NOT support IndexNow. We submit
 * the full canonical URL set from `sitemap()` on a schedule (see `vercel.json`); re-submitting
 * unchanged URLs is allowed and harmless.
 *
 * Auth mirrors the blogging cron: Vercel sends `Authorization: Bearer <CRON_SECRET>` and we
 * require an exact match, so the public internet can't trigger it.
 *
 * Key control: IndexNow requires the host to serve the key string at https://<host>/<key>.txt.
 * That file is `public/2527322a0492b3888fdf24103fb3027c.txt` and is committed on purpose —
 * IndexNow keys are public proof-of-control tokens, not secrets. `INDEXNOW_KEY` overrides the
 * default if rotated (rename the public file to match).
 */
import { NextResponse } from 'next/server';
import sitemap from '@/app/sitemap';
import { SITE_URL } from '@/lib/seo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const DEFAULT_KEY = '2527322a0492b3888fdf24103fb3027c';

function isAuthorized(request: Request): boolean {
  const secret = process.env['CRON_SECRET'];
  if (secret === undefined || secret.length === 0) return false;
  return request.headers.get('authorization') === `Bearer ${secret}`;
}

export async function GET(request: Request): Promise<NextResponse> {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const key = process.env['INDEXNOW_KEY'] ?? DEFAULT_KEY;
  const host = new URL(SITE_URL).host;

  const urlList = sitemap()
    .map((entry) => entry.url)
    .filter((url) => url.startsWith(`https://${host}`));

  if (urlList.length === 0) {
    return NextResponse.json({ ok: false, error: 'no urls in sitemap' }, { status: 500 });
  }

  const res = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({
      host,
      key,
      keyLocation: `https://${host}/${key}.txt`,
      urlList,
    }),
  });

  // IndexNow returns 200 (accepted) or 202 (received, pending key validation) on success.
  const detail = (await res.text().catch(() => '')).slice(0, 200);
  const ok = res.status === 200 || res.status === 202;
  return NextResponse.json(
    { ok, status: res.status, submitted: urlList.length, detail },
    { status: ok ? 200 : 502 },
  );
}
