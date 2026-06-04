import Link from 'next/link';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'secondary' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all duration-200 focus-visible:outline-none disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap';

const VARIANTS: Record<Variant, string> = {
  primary:
    'text-white shadow-glow bg-[linear-gradient(100deg,#6366F1,#8B5CF6_55%,#22D3EE)] hover:brightness-110 active:brightness-95',
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

/** A button, or a Next `<Link>` when `href` is provided. */
export function Button({
  variant = 'primary',
  size = 'md',
  className,
  href,
  ...props
}: CommonProps & { href?: string } & ComponentPropsWithoutRef<'button'>): React.ReactElement {
  const classes = cn(BASE, VARIANTS[variant], SIZES[size], className);
  if (href) {
    return (
      <Link href={href} className={classes}>
        {props.children}
      </Link>
    );
  }
  return <button className={classes} {...props} />;
}
