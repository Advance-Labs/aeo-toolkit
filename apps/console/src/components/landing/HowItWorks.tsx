import { Reveal, Section, SectionHeading } from '@/components/ui';
import { STEPS } from './data';

/**
 * Three-step "how it works" flow. Rendered as an ordered list (good semantics + good
 * for the matching `HowTo` JSON-LD), with a connector line tying the numbered nodes
 * together on desktop.
 */
export function HowItWorks(): React.ReactElement {
  return (
    <Section id="how-it-works">
      <Reveal>
        <SectionHeading
          eyebrow="How it works"
          title="From audit to citations."
          subtitle="Three steps from “invisible to AI” to “quoted in the answer.”"
        />
      </Reveal>

      <ol className="relative mt-16 grid gap-10 md:grid-cols-3 md:gap-6">
        {/* Connector rail (desktop only). */}
        <div
          aria-hidden
          className="absolute left-0 right-0 top-6 hidden h-px bg-gradient-to-r from-transparent via-white/10 to-transparent md:block"
        />
        {STEPS.map((step, i) => (
          <Reveal key={step.title} delay={i * 0.1}>
            <li className="relative flex flex-col gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-ink-900 text-lg font-semibold text-white shadow-glow">
                <span className="bg-gradient-to-br from-brand-indigo via-brand-violet to-brand-cyan bg-clip-text text-transparent">
                  {i + 1}
                </span>
              </span>
              <h3 className="mt-2 text-lg font-semibold text-white">{step.title}</h3>
              <p className="text-sm leading-relaxed text-slate-400">{step.blurb}</p>
            </li>
          </Reveal>
        ))}
      </ol>
    </Section>
  );
}
