'use client';

import { useState } from 'react';
import { cn } from '@/lib/cn';
import { Reveal, Section, SectionHeading } from '@/components/ui';
import { FAQS } from './data';

/**
 * Visible FAQ accordion. The questions/answers mirror the `FAQPage` JSON-LD emitted by
 * the page exactly (both read from `FAQS`), satisfying the SEO plan's requirement that
 * the schema match the on-page content. Client component because it tracks open state;
 * native `<button>`s keep it keyboard- and screen-reader-accessible.
 */
export function Faq(): React.ReactElement {
  // First item open by default so the section never reads as an empty list.
  const [open, setOpen] = useState<number>(0);

  return (
    <Section id="faq">
      <Reveal>
        <SectionHeading
          eyebrow="FAQ"
          title="Questions about answer engines."
          subtitle="The essentials on AEO, llms.txt, and E-E-A-T — the concepts the toolkit puts to work."
        />
      </Reveal>

      <div className="mx-auto mt-12 max-w-3xl">
        <ul className="flex flex-col gap-3">
          {FAQS.map((faq, i) => {
            const isOpen = open === i;
            const panelId = `faq-panel-${i}`;
            const buttonId = `faq-button-${i}`;
            return (
              <li key={faq.question}>
                <div
                  className={cn(
                    'surface overflow-hidden transition-colors duration-200',
                    isOpen && 'border-white/15',
                  )}
                >
                  <h3>
                    <button
                      type="button"
                      id={buttonId}
                      aria-expanded={isOpen}
                      aria-controls={panelId}
                      onClick={() => setOpen(isOpen ? -1 : i)}
                      className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-base font-medium text-white"
                    >
                      <span>{faq.question}</span>
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                        aria-hidden
                        className={cn(
                          'h-5 w-5 shrink-0 text-brand-cyan transition-transform duration-300',
                          isOpen && 'rotate-180',
                        )}
                      >
                        <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  </h3>
                  <div
                    id={panelId}
                    role="region"
                    aria-labelledby={buttonId}
                    className={cn(
                      'grid transition-all duration-300 ease-out',
                      isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
                    )}
                  >
                    <div className="overflow-hidden">
                      <p className="px-5 pb-5 text-sm leading-relaxed text-slate-400">
                        {faq.answer}
                      </p>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </Section>
  );
}
