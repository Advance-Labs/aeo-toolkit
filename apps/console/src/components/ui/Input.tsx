import { forwardRef, type ComponentPropsWithoutRef } from 'react';
import { cn } from '@/lib/cn';

/** Dark, themed text input — the canonical field style across the console. */
export const Input = forwardRef<HTMLInputElement, ComponentPropsWithoutRef<'input'>>(function Input(
  { className, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      className={cn(
        'h-12 w-full rounded-xl border border-white/[0.12] bg-white/[0.04] px-4 text-[15px] text-white outline-none transition placeholder:text-slate-500',
        'focus:border-brand-cyan/60 focus:bg-white/[0.06] focus:ring-2 focus:ring-brand-cyan/20',
        className,
      )}
      {...props}
    />
  );
});
