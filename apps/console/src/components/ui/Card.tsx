import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/** A themed surface panel — the default container for result data and content blocks. */
export function Card({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}): React.ReactElement {
  return <div className={cn('surface p-6 sm:p-7', className)}>{children}</div>;
}
