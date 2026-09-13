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
      style={{ backgroundImage: 'linear-gradient(100deg,#c6ff5c 0%,#a8f326 45%,#b6a4fd 100%)' }}
    >
      {children}
    </span>
  );
}
