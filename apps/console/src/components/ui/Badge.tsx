import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/** Small pill label. `tone` tints the accent. */
export function Badge({
  children,
  className,
  tone = 'cyan',
}: {
  children: ReactNode;
  className?: string;
  tone?: 'cyan' | 'violet' | 'indigo' | 'neutral';
}): React.ReactElement {
  const tones: Record<string, string> = {
    cyan: 'text-brand-cyan border-brand-cyan/25 bg-brand-cyan/10',
    violet: 'text-brand-violet border-brand-violet/25 bg-brand-violet/10',
    indigo: 'text-brand-indigo border-brand-indigo/25 bg-brand-indigo/10',
    neutral: 'text-slate-300 border-white/15 bg-white/5',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium uppercase tracking-wide',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
