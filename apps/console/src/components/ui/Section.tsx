import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Container } from './Container';

/** A vertically-padded page section, optionally wrapping its children in a `Container`. */
export function Section({
  children,
  className,
  id,
  contained = true,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
  contained?: boolean;
}): React.ReactElement {
  return (
    <section id={id} className={cn('relative py-16 sm:py-24', className)}>
      {contained ? <Container>{children}</Container> : children}
    </section>
  );
}
