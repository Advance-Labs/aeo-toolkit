import { cn } from '@/lib/cn';

/** Text with a soft sweeping shimmer — good for eyebrow labels and CTA accents. */
export function ShinyText({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}): React.ReactElement {
  return (
    <span
      className={cn(
        'animate-shimmer bg-clip-text text-transparent [background-size:200%_100%]',
        className,
      )}
      style={{ backgroundImage: 'linear-gradient(110deg,#94a3b8 35%,#ffffff 50%,#94a3b8 65%)' }}
    >
      {children}
    </span>
  );
}
