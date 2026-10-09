import Script from 'next/script';

/**
 * Google Analytics 4, gated on `NEXT_PUBLIC_GA_MEASUREMENT_ID`.
 *
 * The id is NOT hardcoded, deliberately. This console ships as a self-hostable Docker image, and
 * the sibling comment in `layout.tsx` states the contract the other two trackers already keep:
 * they "no-op outside Vercel … so self-hosted/Docker installs are unaffected and no data leaves
 * them". A pasted `G-XXXXXXX` would break that — every self-hoster would silently report their
 * traffic into our property, which is both a privacy problem and garbage data for us.
 *
 * Unset (dev, CI, self-hosters) renders nothing at all: no script tag, no `dataLayer`, no beacon.
 *
 * `afterInteractive` rather than `beforeInteractive`: analytics must never sit on the critical
 * path of a product that sells Core Web Vitals auditing. We would be failing our own check.
 *
 * ⚠️ CONSENT MODE IS NOT CONFIGURED HERE. Google's setup flow notes that EEA visitors need
 * consent mode for ads personalisation and measurement, and doing that properly needs a consent
 * banner wired to `gtag('consent', …)` — a product and legal decision, not a drop-in snippet.
 * This file is the measurement tag only. If EEA traffic matters, add a CMP and call
 * `gtag('consent', 'default', { ad_storage: 'denied', analytics_storage: 'denied' })` BEFORE
 * this script runs, then update on acceptance.
 */
export function GoogleAnalytics(): React.ReactElement | null {
  const measurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

  // Empty string counts as unset: Vercel writes '' rather than deleting a cleared variable.
  if (measurementId === undefined || measurementId.trim() === '') return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
        strategy="afterInteractive"
      />
      <Script id="ga4-init" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${measurementId}');`}
      </Script>
    </>
  );
}
