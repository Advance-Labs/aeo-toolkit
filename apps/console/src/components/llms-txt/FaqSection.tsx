'use client';

import { useState } from 'react';
import type { JSX } from 'react';
import { cn } from '@/lib/cn';
import type { FaqItem } from '@/components/llms-txt/content.js';

/**
 * Accessible FAQ accordion. Each item is a real `<button>` toggling a panel; the
 * visible Q&A text matches the FAQPage JSON-LD on the page (answer engines read both).
 */
export function FaqSection({ items }: { items: readonly FaqItem[] }): JSX.Element {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="flex flex-col gap-3">
      {items.map((item, i) => {
        const isOpen = open === i;
        const panelId = `faq-panel-${i}`;
        const buttonId = `faq-button-${i}`;
        return (
          <div
            key={item.question}
            className={cn(
              'surface overflow-hidden transition-colors',
              isOpen ? 'border-white/15' : 'border-white/[0.08]',
            )}
          >
            <h3 className="m-0">
              <button
                type="button"
                id={buttonId}
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => setOpen(isOpen ? null : i)}
                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
              >
                <span className="text-[15px] font-medium text-white">{item.question}</span>
                <svg
                  aria-hidden
                  viewBox="0 0 24 24"
                  className={cn(
                    'h-5 w-5 shrink-0 text-slate-400 transition-transform duration-300',
                    isOpen && 'rotate-45 text-brand-cyan',
                  )}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                </svg>
              </button>
            </h3>
            <div
              id={panelId}
              role="region"
              aria-labelledby={buttonId}
              hidden={!isOpen}
              className="px-5 pb-5 pt-0"
            >
              <p className="text-sm leading-relaxed text-slate-400">{item.answer}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
