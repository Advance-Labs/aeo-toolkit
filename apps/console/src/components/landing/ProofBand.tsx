import { Container, CountUp, Reveal } from '@/components/ui';
import { PROOF_STATS } from './data';

/**
 * "By the numbers" results band — a horizontal strip of animated CountUp figures that
 * give the page a confident, quantified read (modeled on the results/stat band that
 * high-converting SaaS landings put directly under the hero). Every number is a real
 * capability of the toolkit, and the final value is in the SSR HTML, so the band is
 * honest and fully crawlable even before — or without — the count animation.
 */
export function ProofBand(): React.ReactElement {
  return (
    <section className="relative py-14 sm:py-16" aria-label="AEO Toolkit by the numbers">
      <Container>
        <Reveal>
          <div className="surface grid grid-cols-2 gap-y-10 px-6 py-10 sm:px-10 md:grid-cols-5 md:gap-x-6">
            {PROOF_STATS.map((stat) => (
              <div
                key={stat.label}
                className="flex flex-col items-center gap-1.5 text-center md:px-2"
              >
                <span className="text-gradient text-4xl font-semibold tracking-tight sm:text-5xl">
                  <CountUp to={stat.to} prefix={stat.prefix} suffix={stat.suffix} />
                </span>
                <span className="max-w-[12rem] text-xs leading-snug text-slate-400 sm:text-sm">
                  {stat.label}
                </span>
              </div>
            ))}
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
