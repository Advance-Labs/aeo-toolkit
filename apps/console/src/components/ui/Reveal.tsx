'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * Fades + slides its children up the first time they enter the viewport — as a *pure enhancement*.
 *
 * Robustness contract: content is **visible by default**. The server-rendered HTML and the first
 * client paint always render at full opacity, so no-JS visitors, crawlers, screenshot tools, reduced-
 * motion users, and slow hydration can NEVER get stuck looking at faded/clipped content. The hidden
 * → shown animation is only ever armed, on the client, for elements that mount *clearly below the
 * fold* (where the brief hide is invisible to the user) and is then released by an IntersectionObserver
 * with a timer safety-net. Anything in or near the viewport at mount simply stays visible.
 */
export function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}): React.ReactElement {
  const ref = useRef<HTMLDivElement>(null);
  // 'static' = visible, no animation (the safe default rendered on the server and first paint).
  // 'hidden' = armed below the fold, waiting to reveal. 'shown' = revealed (animating to visible).
  const [state, setState] = useState<'static' | 'hidden' | 'shown'>('static');

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return; // stay visible
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return; // stay visible

    // Only animate elements that are clearly below the fold at mount — hiding them now is invisible
    // to the user. Anything already in or near view stays visible (no flash, no stuck state).
    const top = el.getBoundingClientRect().top;
    if (top <= window.innerHeight * 0.9) return;

    setState('hidden');
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setState('shown');
          io.disconnect();
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.01 },
    );
    io.observe(el);
    // Safety net: never let an armed element remain hidden, even if the observer never fires.
    const fallback = window.setTimeout(() => setState('shown'), 1200);
    return () => {
      io.disconnect();
      window.clearTimeout(fallback);
    };
  }, []);

  return (
    <div
      ref={ref}
      className={cn(
        'transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform',
        state === 'hidden' ? 'translate-y-5 opacity-0' : 'translate-y-0 opacity-100',
        className,
      )}
      style={{ transitionDelay: state === 'shown' ? `${delay}s` : '0s' }}
    >
      {children}
    </div>
  );
}
