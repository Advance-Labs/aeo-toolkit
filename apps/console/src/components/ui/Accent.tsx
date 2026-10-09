import { cn } from '@/lib/cn';

/**
 * Emphasis inside a headline — one phrase, carried by colour rather than decoration.
 *
 * Replaces `GradientText`, which painted a three-stop `linear-gradient(100deg, #c6ff5c, #a8f326,
 * #b6a4fd)` and, by default, ANIMATED it on a 6s infinite loop. An animated gradient headline is
 * the strongest single "this site was generated" signal a page can carry, and it was on 75
 * headlines across 16 files.
 *
 * Renamed rather than quietly re-implemented. Leaving a component called `GradientText` that
 * renders no gradient would repeat the mistake this pass exists to fix — `brand.cyan` was defined
 * as `#A8F326`, acid green, and misled every reader of the codebase.
 *
 * `pulse` is the accent and it is rationed: one emphasised phrase per headline, and the headline
 * still reads correctly if you ignore the colour (WCAG 1.4.1 — never carry meaning by colour
 * alone). For secondary emphasis that is NOT a call to action, pass `tone="annotate"`.
 */
export function Accent({
  children,
  className,
  tone = 'pulse',
}: {
  children: React.ReactNode;
  className?: string;
  tone?: 'pulse' | 'annotate';
}): React.ReactElement {
  return (
    <span className={cn(tone === 'pulse' ? 'text-pulse' : 'text-annotate', className)}>
      {children}
    </span>
  );
}
