'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';

/**
 * Counts a number up from `from` to `to` the first time it scrolls into view.
 *
 * Adapted from the React Bits `CountUp` component, but rewritten to use a plain
 * `requestAnimationFrame` loop + `IntersectionObserver` instead of `motion/react`,
 * so it stays dependency-free and matches this codebase's hand-rolled `Reveal` pattern.
 * Visible-by-default: the final value renders in the server HTML and for reduced-motion /
 * no-JS visitors, so crawlers and AI bots always read the real number.
 */
export function CountUp({
  to,
  from = 0,
  duration = 1.6,
  prefix = '',
  suffix = '',
  separator = '',
  className,
}: {
  to: number;
  from?: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  separator?: string;
  className?: string;
}): React.ReactElement {
  const ref = useRef<HTMLSpanElement>(null);
  const [value, setValue] = useState<number>(to); // start at the real value (SSR-safe)

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    // Arm the animation: drop to the start value, then count up on intersection.
    setValue(from);
    let raf = 0;
    let start = 0;
    const animate = (now: number): void => {
      if (!start) start = now;
      const t = Math.min((now - start) / (duration * 1000), 1);
      // easeOutCubic — settles confidently rather than linearly.
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(from + (to - from) * eased);
      if (t < 1) raf = requestAnimationFrame(animate);
    };

    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          raf = requestAnimationFrame(animate);
          io.disconnect();
        }
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [from, to, duration]);

  const decimals = Math.max(decimalPlaces(from), decimalPlaces(to));
  const formatted = new Intl.NumberFormat('en-US', {
    useGrouping: Boolean(separator),
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
  const display = separator ? formatted.replace(/,/g, separator) : formatted;

  return (
    <span ref={ref} className={cn('tabular-nums', className)}>
      {prefix}
      {display}
      {suffix}
    </span>
  );
}

function decimalPlaces(n: number): number {
  const frac = n.toString().split('.')[1];
  if (!frac) return 0;
  return parseInt(frac, 10) === 0 ? 0 : frac.length;
}
