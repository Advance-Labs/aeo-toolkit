import { cn } from '@/lib/cn';

/** Headline text painted with the brand gradient; optionally animates the gradient. */
export function GradientText({
  children,
  className,
  animate = true,
}: {
  children: React.ReactNode;
  className?: string;
  animate?: boolean;
}): React.ReactElement {
  return (
    <span
      className={cn(
        'bg-clip-text text-transparent [background-size:200%_auto]',
        animate && 'animate-gradient-pan',
        className,
      )}
      style={{ backgroundImage: 'linear-gradient(100deg,#818cf8 0%,#a78bfa 45%,#22d3ee 100%)' }}
    >
      {children}
    </span>
  );
}
