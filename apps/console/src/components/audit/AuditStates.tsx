import type { JSX } from 'react';
import { ThinkingOrb } from 'thinking-orbs';

export function AuditLoading(): JSX.Element {
  const label = 'Crawling and scoring the site — this can take a moment for larger sites.';
  return (
    <div className="surface flex flex-col gap-5 p-6 sm:p-7" aria-live="polite" aria-busy="true">
      <div className="flex items-center gap-3">
        <ThinkingOrb state="working" size={20} theme="auto" aria-hidden="true" />
        <p className="text-sm font-medium text-slate-200">{label}</p>
      </div>
      {/* Skeleton shimmer rows hint at the layout that's about to appear. */}
      <div className="grid gap-4 sm:grid-cols-[auto,1fr]">
        <div className="h-28 w-28 animate-pulse rounded-full bg-white/[0.06]" />
        <div className="flex flex-col justify-center gap-3">
          <div className="h-3 w-2/3 animate-pulse rounded-full bg-white/[0.06]" />
          <div className="h-3 w-1/2 animate-pulse rounded-full bg-white/[0.05]" />
          <div className="h-3 w-3/4 animate-pulse rounded-full bg-white/[0.04]" />
        </div>
      </div>
      <div className="flex flex-col gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex flex-col gap-1.5">
            <div className="h-2.5 w-1/4 animate-pulse rounded-full bg-white/[0.05]" />
            <div className="h-2 w-full animate-pulse rounded-full bg-white/[0.04]" />
          </div>
        ))}
      </div>
    </div>
  );
}
