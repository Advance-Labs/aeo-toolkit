import { Badge, Card, Reveal, Section, SectionHeading } from '@/components/ui';
import { COMPARE, STATS } from './data';

/**
 * "AEO vs SEO" explainer. A semantic comparison `<table>` (crawler- and AI-friendly,
 * exactly the extractable structure the SEO plan calls for) sits beside a column of
 * headline stat callouts.
 */
export function WhyAeo(): React.ReactElement {
  return (
    <Section id="why-aeo">
      <Reveal>
        <SectionHeading
          eyebrow="AEO vs SEO"
          title="Ranking is not"
          gradient="enough anymore."
          subtitle="Search is shifting from ten blue links to a single synthesized answer. AEO optimizes for being the source that answer cites."
        />
      </Reveal>

      <div className="mt-14 grid items-start gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Reveal>
          <Card className="overflow-hidden p-0">
            <table className="w-full border-collapse text-left text-sm">
              <caption className="sr-only">
                How Answer Engine Optimization compares to classic SEO
              </caption>
              <thead>
                <tr className="border-b border-white/[0.08]">
                  <th scope="col" className="px-5 py-4 font-medium text-slate-500" />
                  <th scope="col" className="px-5 py-4 font-medium text-slate-400">
                    Classic SEO
                  </th>
                  <th scope="col" className="px-5 py-4">
                    <Badge tone="cyan">AEO</Badge>
                  </th>
                </tr>
              </thead>
              <tbody>
                {COMPARE.map((row) => (
                  <tr key={row.aspect} className="border-b border-white/[0.05] last:border-0">
                    <th scope="row" className="px-5 py-4 font-medium text-white">
                      {row.aspect}
                    </th>
                    <td className="px-5 py-4 text-slate-400">{row.seo}</td>
                    <td className="px-5 py-4 font-medium text-slate-200">{row.aeo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </Reveal>

        <Reveal delay={0.1}>
          <dl className="grid grid-cols-2 gap-4">
            {STATS.map((stat) => (
              <div key={stat.label} className="surface flex flex-col gap-1 p-5">
                <dt className="sr-only">{stat.label}</dt>
                <dd className="bg-gradient-to-br from-white to-slate-400 bg-clip-text text-4xl font-semibold tracking-tight text-transparent">
                  {stat.value}
                </dd>
                <p aria-hidden className="text-xs leading-snug text-slate-500">
                  {stat.label}
                </p>
              </div>
            ))}
          </dl>
        </Reveal>
      </div>
    </Section>
  );
}
