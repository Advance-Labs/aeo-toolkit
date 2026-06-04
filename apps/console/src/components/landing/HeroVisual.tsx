import { Icon } from './Icon';

/**
 * Decorative hero artwork: a glassy "AEO score" gauge framed by concentric orbit
 * rings and two floating signal chips. Pure SVG + CSS (no JS, no WebGL) so it costs
 * nothing on first paint and respects `prefers-reduced-motion` via the global rule.
 * Marked `aria-hidden` — it carries no information the copy doesn't already state.
 */
export function HeroVisual(): React.ReactElement {
  const score = 92;
  const radius = 78;
  const circumference = 2 * Math.PI * radius;
  // Show the arc filled to ~92% for a confident, "you're winning" read.
  const dash = circumference * (score / 100);

  return (
    <div aria-hidden className="relative mx-auto aspect-square w-full max-w-[440px]">
      {/* Soft brand glow behind the gauge. */}
      <div className="absolute inset-6 rounded-full bg-[radial-gradient(circle_at_50%_40%,rgba(99,102,241,0.35),rgba(34,211,238,0.12)_55%,transparent_72%)] blur-2xl" />

      {/* Drifting orbit rings. */}
      <div className="absolute inset-0 animate-float [animation-duration:9s]">
        <div className="absolute inset-0 rounded-full border border-white/[0.06]" />
        <div className="absolute inset-[14%] rounded-full border border-white/[0.05]" />
        <div className="absolute inset-[28%] rounded-full border border-dashed border-brand-cyan/15" />
      </div>

      {/* Central gauge card. */}
      <div className="surface absolute inset-[20%] flex flex-col items-center justify-center rounded-full !rounded-full shadow-glow">
        <svg viewBox="0 0 200 200" className="absolute inset-0 h-full w-full -rotate-90">
          <circle
            cx="100"
            cy="100"
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.07)"
            strokeWidth={10}
          />
          <circle
            cx="100"
            cy="100"
            r={radius}
            fill="none"
            stroke="url(#heroGaugeGrad)"
            strokeWidth={10}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circumference}`}
          />
          <defs>
            <linearGradient id="heroGaugeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#6366F1" />
              <stop offset="55%" stopColor="#8B5CF6" />
              <stop offset="100%" stopColor="#22D3EE" />
            </linearGradient>
          </defs>
        </svg>
        <span className="text-5xl font-semibold tracking-tight text-white">{score}</span>
        <span className="mt-1 text-[0.7rem] font-medium uppercase tracking-[0.18em] text-brand-cyan">
          AEO score
        </span>
      </div>

      {/* Floating signal chips. */}
      <div className="surface absolute left-0 top-[18%] flex items-center gap-2 rounded-xl px-3 py-2 shadow-glow animate-float [animation-duration:7s]">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-indigo/15 text-brand-indigo">
          <Icon name="doc" className="h-4 w-4" />
        </span>
        <span className="text-xs font-medium text-slate-200">llms.txt ready</span>
      </div>

      <div className="surface absolute bottom-[14%] right-0 flex items-center gap-2 rounded-xl px-3 py-2 shadow-glow animate-float [animation-duration:8s] [animation-delay:-2s]">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-cyan/15 text-brand-cyan">
          <Icon name="shield" className="h-4 w-4" />
        </span>
        <span className="text-xs font-medium text-slate-200">E-E-A-T verified</span>
      </div>
    </div>
  );
}
