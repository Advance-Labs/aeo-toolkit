import { SITE_NAME, SITE_DESCRIPTION } from '@/lib/seo';

// An ordinary route keeps Next from injecting a root-relative manifest link.
// The layout supplies the link with assetUrl(), which works behind the proxy.
export function GET(): Response {
  const manifest = {
    name: `${SITE_NAME} — Answer Engine Optimization Suite`,
    short_name: SITE_NAME,
    description: SITE_DESCRIPTION,
    start_url: '/',
    display: 'standalone',
    background_color: '#05060f',
    theme_color: '#05060f',
    icons: [
      {
        src: '/icon.png',
        type: 'image/png',
        sizes: '256x256',
        purpose: 'any',
      },
      {
        src: '/apple-icon.png',
        type: 'image/png',
        sizes: '180x180',
        purpose: 'any',
      },
    ],
  };
  return new Response(JSON.stringify(manifest), {
    headers: { 'Content-Type': 'application/manifest+json; charset=utf-8' },
  });
}
