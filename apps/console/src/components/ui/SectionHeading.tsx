import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { GradientText } from './GradientText';

/** Eyebrow + headline + subtitle block used to introduce a section. */
export function SectionHeading({
  eyebrow,
  title,
  gradient,
  subtitle,
  align = 'center',
  className,
}: {
  eyebrow?: string;
  title: ReactNode;
  /** When provided, this trailing fragment of the title is painted with the brand gradient. */
  gradient?: string;
  subtitle?: ReactNode;
  align?: 'center' | 'left';
  className?: string;
}): React.ReactElement {
  return (
    <div
      className={cn(
        'flex flex-col gap-4',
        align === 'center' ? 'items-center text-center' : 'items-start text-left',
        className,
      )}
    >
      {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
      <h2 className="max-w-2xl text-balance text-3xl font-semibold leading-tight text-white sm:text-4xl md:text-[2.75rem]">
        {title} {gradient ? <GradientText>{gradient}</GradientText> : null}
      </h2>
      {subtitle ? (
        <p
          className={cn(
            'max-w-2xl text-base leading-relaxed text-slate-400 sm:text-lg',
            align === 'center' && 'mx-auto',
          )}
        >
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}
