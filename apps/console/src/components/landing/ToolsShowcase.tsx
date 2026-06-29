import Link from 'next/link';
import { Reveal, Section, SectionHeading, SpotlightCard } from '@/components/ui';
import { TOOLS } from './data';
import { Icon } from './Icon';

/**
 * The five tools as a rich card grid (`id="tools"` — the hero's secondary CTA target).
 * Each card is a full-bleed `<Link>` so the entire surface is clickable, with a
 * spotlight glow on hover and an animated "Open tool" affordance.
 */
export function ToolsShowcase(): React.ReactElement {
  return (
    <Section id="tools">
      <Reveal>
        <SectionHeading
          align="left"
          eyebrow="The toolkit"
          title="Five tools, one console."
          subtitle="Each tool targets a different lever of AI visibility. Use them on their own or run the full sweep from one place."
        />
      </Reveal>

      <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {TOOLS.map((tool, i) => (
          <Reveal key={tool.href} delay={i * 0.06}>
            <SpotlightCard className="h-full">
              <Link
                href={tool.href}
                className="flex h-full flex-col gap-4 p-6 focus-visible:outline-none"
              >
                <div className="flex items-center justify-between">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-gradient-to-br from-brand-violet/20 to-brand-indigo/10 text-brand-cyan">
                    <Icon name={tool.icon} className="h-5 w-5" />
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[0.7rem] font-medium uppercase tracking-wide text-slate-400">
                    {tool.tag}
                  </span>
                </div>
                <h3 className="text-lg font-semibold text-white">{tool.name}</h3>
                <p className="text-sm leading-relaxed text-slate-400">{tool.blurb}</p>
                <span className="mt-auto inline-flex items-center gap-1.5 pt-2 text-sm font-medium text-brand-cyan transition-transform duration-200 group-hover:translate-x-1">
                  Open tool
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    aria-hidden
                    className="h-4 w-4"
                  >
                    <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              </Link>
            </SpotlightCard>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
