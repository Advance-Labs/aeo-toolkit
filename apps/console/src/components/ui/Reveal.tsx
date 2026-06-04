'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * Fades + slides its children up the first time they enter the viewport.
 *
 * Uses a plain IntersectionObserver + CSS transition (reliable across SSR/hydration) with a safety-net
 * timer so content can NEVER stay invisible — if the observer never fires, JS is slow, or motion is
 * reduced, the content is revealed regardless.
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
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) {
      setShown(true);
      return;
    }
    if (typeof IntersectionObserver === 'undefined') {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShown(true);
          io.disconnect();
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.01 },
    );
    io.observe(el);
    // Safety net: never let content remain hidden, even if the observer never fires.
    const fallback = window.setTimeout(() => setShown(true), 1100);
    return () => {
      io.disconnect();
      window.clearTimeout(fallback);
    };
  }, []);

  return (
    <div
      ref={ref}
      className={cn(
        'transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform motion-reduce:!translate-y-0 motion-reduce:!opacity-100 motion-reduce:transition-none',
        shown ? 'translate-y-0 opacity-100' : 'translate-y-5 opacity-0',
        className,
      )}
      style={{ transitionDelay: shown ? `${delay}s` : '0s' }}
    >
      {children}
    </div>
  );
}
