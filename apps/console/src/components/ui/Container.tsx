import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/** Centered content column with consistent horizontal padding. */
export function Container({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}): React.ReactElement {
  return (
    <div className={cn('mx-auto w-full max-w-content px-5 sm:px-8', className)}>{children}</div>
  );
}
