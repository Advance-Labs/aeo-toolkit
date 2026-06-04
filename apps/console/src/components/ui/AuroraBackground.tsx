import { cn } from '@/lib/cn';

/**
 * Animated aurora backdrop — soft brand-colored gradient blobs drifting behind a faint grid, with a
 * vignette so foreground content stays readable. Pure CSS (no WebGL), respects prefers-reduced-motion.
 */
export function AuroraBackground({ className }: { className?: string }): React.ReactElement {
  return (
    <div
      aria-hidden
      className={cn(
        'pointer-events-none absolute inset-x-0 top-0 -z-10 h-[125vh] overflow-hidden',
        className,
      )}
    >
      <div className="absolute left-1/2 top-[-25%] h-[60vh] w-[60vw] -translate-x-1/2 rounded-full bg-brand-violet/30 blur-[130px] animate-aurora-1" />
      <div className="absolute left-[6%] top-[4%] h-[48vh] w-[48vw] rounded-full bg-brand-indigo/25 blur-[130px] animate-aurora-2" />
      <div className="absolute right-[2%] top-[14%] h-[44vh] w-[44vw] rounded-full bg-brand-cyan/20 blur-[140px] animate-aurora-1" />
      <div className="absolute inset-0 bg-grid-fade [background-size:56px_56px] [mask-image:radial-gradient(ellipse_75%_60%_at_50%_0%,#000_25%,transparent_100%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_120%_70%_at_50%_-10%,transparent_45%,rgba(5,6,15,0.75)_100%)]" />
    </div>
  );
}
