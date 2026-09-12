import Link from 'next/link';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'secondary' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all duration-200 focus-visible:outline-none disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap';

const VARIANTS: Record<Variant, string> = {
  primary:
    'text-[#0c0f05] shadow-glow border border-[#dcff8c]/60 bg-[linear-gradient(180deg,#c6ff5c,#a8f326)] hover:brightness-110 active:brightness-95',
  secondary:
    'text-white border border-white/15 bg-white/[0.04] hover:bg-white/[0.08] hover:border-white/25',
  ghost: 'text-slate-300 hover:text-white hover:bg-white/[0.06]',
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
