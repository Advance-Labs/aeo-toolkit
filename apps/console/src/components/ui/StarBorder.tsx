import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * A pill/panel wrapped in a slow-orbiting brand glow that sweeps along its border —
 * adapted from the React Bits `StarBorder` component, restyled to this design system's
 * tokens (brand cyan/violet, the glass `surface` inner) instead of React Bits' default
 * black/white. Pure CSS (two animated radial sweeps), no JS, no extra dependencies, and
 * the sweep keyframes respect `prefers-reduced-motion` via the global rule.
 */
export function StarBorder({
  children,
  className,
  color = 'rgba(34,211,238,0.9)',
  speed = '6s',
}: {
  children: ReactNode;
  className?: string;
  /** Color of the orbiting glow. Defaults to brand cyan. */
  color?: string;
  /** Duration of one sweep. */
  speed?: string;
}): React.ReactElement {
  return (
    <div className={cn('relative inline-block overflow-hidden rounded-full py-[1.5px]', className)}>
      <span
        aria-hidden
        className="absolute bottom-[-11px] right-[-250%] z-0 h-[50%] w-[300%] rounded-full opacity-60 animate-star-movement-bottom"
        style={{ background: `radial-gradient(circle, ${color}, transparent 10%)`, animationDuration: speed }}
      />
      <span
        aria-hidden
        className="absolute left-[-250%] top-[-10px] z-0 h-[50%] w-[300%] rounded-full opacity-60 animate-star-movement-top"
        style={{ background: `radial-gradient(circle, ${color}, transparent 10%)`, animationDuration: speed }}
      />
      <div className="surface relative z-[1] rounded-full !backdrop-blur-md">{children}</div>
    </div>
  );
}
