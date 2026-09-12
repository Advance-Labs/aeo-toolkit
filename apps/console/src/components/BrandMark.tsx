/**
 * Brand mark v3 — the Advance Labs mark: the crumpled-paper sphere from advancelabs.dev,
 * replacing the printer's registration crosshair (v2). The mark is a raster with alpha
 * (`/advance-labs-mark-256.png`, cropped square), so it renders identically on the dark
 * shell and on paper surfaces; it no longer takes a color from `currentColor`.
 *
 * The src goes through `assetUrl` because these pages are also served from
 * advancelabs.dev/tools/* by a rewrite. A root-relative src resolves against THAT domain,
 * which has no such file, so the mark 404s for anyone on the proxied origin while looking
 * perfect on aeo.advancelabs.dev. See src/lib/asset-url.ts.
 */

import { assetUrl } from '@/lib/asset-url';

interface BrandMarkProps {
  size?: number;
  className?: string;
}

export function BrandMark({ size = 24, className }: BrandMarkProps): React.ReactElement {
  return (
    <img
      src={assetUrl('/advance-labs-mark-256.png')}
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
      draggable={false}
      className={className}
      style={{ display: 'inline-block', objectFit: 'contain', flexShrink: 0 }}
    />
  );
}

/** Mark + wordmark lockup. `tone` picks the wordmark color for dark or paper grounds. */
export function BrandLockup({
  size = 24,
  tone = 'dark',
}: {
  size?: number;
  tone?: 'dark' | 'paper';
}): React.ReactElement {
  const color = tone === 'dark' ? '#A8F326' : '#16150F';
  return (
    <span className="inline-flex items-center gap-2.5" style={{ color }}>
      <BrandMark size={size} />
      <span
        className="text-[17px] font-bold tracking-tight"
        style={{ fontFamily: 'var(--font-brand), var(--font-sans), system-ui, sans-serif', letterSpacing: '-0.01em' }}
      >
        AEO&nbsp;Toolkit
      </span>
    </span>
  );
}
