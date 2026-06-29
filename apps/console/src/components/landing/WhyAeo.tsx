import { Badge, Button, Card, Reveal, Section, SectionHeading } from '@/components/ui';
import { COMPARE } from './data';

/**
 * "AEO vs SEO" explainer. A semantic comparison `<table>` (crawler- and AI-friendly,
 * exactly the extractable structure the SEO plan calls for) is the focus, paired with a
 * short framing callout that reinforces the shift to answer engines and routes to the audit.
 */
export function WhyAeo(): React.ReactElement {
  return (
    <Section id="why-aeo">
      <Reveal>
        <SectionHeading
          align="left"
          eyebrow="AEO vs SEO"
          title="Ranking is not enough anymore."
          subtitle="Search is shifting from ten blue links to a single synthesized answer. AEO optimizes for being the source that answer cites."
        />
      </Reveal>

      <div className="mt-14 grid items-start gap-6 lg:grid-cols-[1.5fr_1fr]">
        <Reveal>
          <Card className="overflow-hidden p-0">
            <table className="w-full border-collapse text-left text-sm">
              <caption className="sr-only">
                How Answer Engine Optimization compares to classic SEO
              </caption>
              <thead>
                <tr className="border-b border-white/[0.08]">
                  <th scope="col" className="px-5 py-4 font-medium text-slate-400" />
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
          <div className="surface flex h-full flex-col gap-5 p-7">
            <Badge tone="violet">The shift</Badge>
            <p className="text-pretty text-lg font-medium leading-relaxed text-slate-200">
              Over half of searches now end without a click. When the answer is synthesized for the
              user, the only visibility that counts is being{' '}
              <span className="text-white">the source it quotes.</span>
            </p>
            <p className="text-sm leading-relaxed text-slate-400">
              The toolkit scores exactly the signals answer engines weigh — structure, E-E-A-T, and
              extractable answers — and hands you the fixes in priority order.
            </p>
            <Button href="/tools/audit" variant="secondary" size="md" className="mt-auto self-start">
              Score my site
            </Button>
          </div>
        </Reveal>
      </div>
    </Section>
  );
}
