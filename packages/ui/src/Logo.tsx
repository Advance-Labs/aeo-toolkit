import type { JSX } from 'react';
import { cx } from './utils.js';

/**
 * Default gradient-id suffix for {@link LogoMark}. Deterministic so the markup is
 * stable across renders; callers rendering multiple marks on one page should pass a
 * distinct `idSuffix` to each so their `<linearGradient>` ids never collide.
 */
const DEFAULT_ID_SUFFIX = 'aeo';

export interface LogoMarkProps {
  /** Rendered width/height in pixels (the mark is square). Defaults to 32. */
  size?: number;
  /** Accessible title for the SVG. Defaults to `"AEO Toolkit"`. */
  title?: string;
  /**
   * Suffix folded into the SVG gradient id so multiple marks on one page get
   * unique ids. Deterministic — pass distinct values per instance. Defaults to a
   * fixed constant.
   */
  idSuffix?: string;
}

/**
 * The square app-tile mark: an indigo→violet gradient tile holding an upward-peak
 * "A" with a cyan AI sparkle off the apex. Faithfully reproduces `brand/mark.svg`
 * on a `0 0 64 64` viewBox, scaled to `size`. Presentational only.
 */
export function LogoMark({
  size = 32,
  title = 'AEO Toolkit',
  idSuffix = DEFAULT_ID_SUFFIX,
}: LogoMarkProps): JSX.Element {
  const gradientId = `aeoTile-${idSuffix}`;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      role="img"
      aria-label={title}
    >
      <title>{title}</title>
      <defs>
        <linearGradient
          id={gradientId}
          x1="6"
          y1="4"
          x2="58"
          y2="60"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#6366F1" />
          <stop offset="1" stopColor="#8B5CF6" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="60" height="60" rx="14" fill={`url(#${gradientId})`} />
      <path
        d="M18.5 46.5 32 18 45.5 46.5"
        fill="none"
        stroke="#fff"
        strokeWidth="6.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M24.2 34.6H39.8" fill="none" stroke="#fff" strokeWidth="5.5" strokeLinecap="round" />
      <path
        d="M44 9.2 45.1 13.4 49.3 14.5 45.1 15.6 44 19.8 42.9 15.6 38.7 14.5 42.9 13.4Z"
        fill="#22D3EE"
      />
    </svg>
  );
}

export interface LogoProps {
  /** Height of the mark in pixels (the wordmark scales alongside). Defaults to 32. */
  size?: number;
  /** Theme variant. `'dark'` uses light text for dark backgrounds. Defaults to `'light'`. */
  variant?: 'light' | 'dark';
  /** Extra Tailwind classes appended to the wrapper. */
  className?: string;
}

interface WordmarkColors {
  /** "AEO" color class. */
  primary: string;
  /** "Toolkit" color class. */
  secondary: string;
}

const WORDMARK_COLORS: Record<NonNullable<LogoProps['variant']>, WordmarkColors> = {
  // Ink #0F172A / Slate #64748B on light surfaces.
  light: { primary: 'text-[#0F172A]', secondary: 'text-[#64748B]' },
  // Light #F8FAFC / #94A3B8 on dark surfaces.
  dark: { primary: 'text-[#F8FAFC]', secondary: 'text-[#94A3B8]' },
};

/**
 * Horizontal lockup: the {@link LogoMark} tile beside the "AEO Toolkit" wordmark
 * ("AEO" bold, "Toolkit" medium). On `'dark'` the wordmark uses light text for
 * contrast. Presentational only — plain inline SVG + Tailwind classes.
 */
export function Logo({ size = 32, variant = 'light', className }: LogoProps): JSX.Element {
  const colors = WORDMARK_COLORS[variant];
  return (
    <span className={cx('inline-flex items-center gap-2', className)}>
      <LogoMark size={size} idSuffix={`lockup-${variant}`} />
      <span className="font-sans tracking-tight" style={{ fontSize: size * 0.6, lineHeight: 1 }}>
        <span className={cx('font-bold', colors.primary)}>AEO</span>
        <span className={cx('font-medium', colors.secondary)}> Toolkit</span>
      </span>
    </span>
  );
}
