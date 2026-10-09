import Link from 'next/link';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'secondary' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-lg font-medium tracking-meta uppercase '
  + 'transition-opacity duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 '
  + 'focus-visible:outline-pulse disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap';

/*
 * The action colour is WHITE, not green — the runs-on.dev rule. Green is `pulse` and it is
 * reserved for live state; spending it on every button is what turned a signal into decoration.
 *
 * Primary used to be `bg-[linear-gradient(180deg,#c6ff5c,#a8f326)]` with `shadow-glow` and a
 * `brightness-110` hover. A gradient fill under a glow under a brightness shift is three effects
 * doing one job. The hover is now `opacity: .9` and nothing else.
 */
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-ink text-paper hover:opacity-90 active:opacity-80',
  secondary: 'text-ink border border-rule-strong bg-transparent hover:border-ink/40',
  ghost: 'text-ink-muted hover:text-ink',
};

const SIZES: Record<Size, string> = {
  sm: 'h-9 px-3.5 text-sm',
  md: 'h-11 px-5 text-sm',
  lg: 'h-12 px-6 text-base',
};

type CommonProps = { variant?: Variant; size?: Size; className?: string; children?: ReactNode };

/**
 * A button, or a Next `<Link>` when `href` is provided. Pass `native` for an href that is not a page
 * (e.g. a route handler that redirects off-site): `<Link>` would first try a client-side RSC fetch,
 * fail on the cross-origin redirect, then fall back to a full load, hitting the route twice.
 */
export function Button({
  variant = 'primary',
  size = 'md',
  className,
  href,
  prefetch,
  native,
  ...props
}: CommonProps & {
  href?: string;
  prefetch?: boolean;
  native?: boolean;
} & ComponentPropsWithoutRef<'button'>): React.ReactElement {
  const classes = cn(BASE, VARIANTS[variant], SIZES[size], className);
  if (href && native) {
    return (
      <a href={href} className={classes}>
        {props.children}
      </a>
    );
  }
  if (href) {
    return (
      <Link href={href} prefetch={prefetch} className={classes}>
        {props.children}
      </Link>
    );
  }
  return <button className={classes} {...props} />;
}
