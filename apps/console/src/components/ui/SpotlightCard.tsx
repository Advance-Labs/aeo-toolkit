'use client';

import { useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

/** A surface card with a brand-colored radial glow that follows the cursor on hover. */
export function SpotlightCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}): React.ReactElement {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  return (
    <div
      ref={ref}
      onMouseMove={(e) => {
        const el = ref.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        setPos({ x: e.clientX - r.left, y: e.clientY - r.top });
      }}
      className={cn(
        'group relative overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.025] transition-colors duration-300 hover:border-white/20',
        className,
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background: `radial-gradient(320px circle at ${pos.x}px ${pos.y}px, rgba(99,102,241,0.18), rgba(34,211,238,0.06) 40%, transparent 70%)`,
        }}
      />
      <div className="relative">{children}</div>
    </div>
  );
}
