import { Reveal, Section, SectionHeading, SpotlightCard } from '@/components/ui';
import { FEATURES } from './data';
import { Icon } from './Icon';

/**
 * Value-prop grid. Each card is a `SpotlightCard` (cursor-following brand glow) with
 * an inline SVG icon, so the section reads as a polished, interactive feature wall.
 */
export function Features(): React.ReactElement {
  return (
    <Section id="features">
      <Reveal>
        <SectionHeading
          eyebrow="Why AEO Toolkit"
          title="Everything you need to win"
          gradient="AI search."
          subtitle="One workflow to make your site crawlable, trustworthy, and quotable — the three things answer engines reward when they choose what to cite."
        />
      </Reveal>

      <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map((feature, i) => (
          <Reveal key={feature.title} delay={i * 0.08}>
            <SpotlightCard className="h-full p-6">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-gradient-to-br from-brand-indigo/20 to-brand-cyan/10 text-brand-cyan">
                <Icon name={feature.icon} className="h-5 w-5" />
              </span>
              <h3 className="mt-5 text-lg font-semibold text-white">{feature.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">{feature.blurb}</p>
            </SpotlightCard>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
