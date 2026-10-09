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
  tone?: 'cyan' | 'violet' | 'indigo' | 'neutral' | 'pulse';
}): React.ReactElement {
  /*
   * Was a tinted, filled, fully-rounded pill in three brand colours. DESIGN.md's term for that
   * is "pill badges scattered as decoration", and there were 83 of them.
   *
   * It is now a `.meta` label: mono, uppercase, tracked, muted — the same treatment runs-on.dev
   * uses for every piece of metadata on the page. It reads as a field name rather than a sticker.
   * `tone` is kept so 23 call sites do not need editing, but only `pulse` tints, and only because
   * a live-state label genuinely should.
   */
  const tones: Record<string, string> = {
    cyan: 'text-ink-muted',
    violet: 'text-ink-muted',
    indigo: 'text-ink-muted',
    neutral: 'text-ink-muted',
    pulse: 'text-pulse',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 self-start font-mono text-xs uppercase tracking-meta',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
