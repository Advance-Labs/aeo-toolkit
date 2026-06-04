import { Container, Reveal } from '@/components/ui';
import { ENGINES } from './data';

/**
 * Thin social-proof band naming the AI surfaces the toolkit optimizes for. The
 * engine names are rendered as styled wordmarks (no third-party logos) so the strip
 * stays fast, license-clean, and on-brand.
 */
export function TrustStrip(): React.ReactElement {
  return (
    <section
      className="border-y border-white/[0.06] bg-white/[0.015] py-10"
      aria-label="Supported answer engines"
    >
      <Container>
        <Reveal className="flex flex-col items-center gap-6">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
            Optimizes your visibility across
          </p>
          <ul className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4 sm:gap-x-12">
            {ENGINES.map((engine) => (
              <li
                key={engine}
                className="text-base font-semibold text-slate-400 transition-colors duration-200 hover:text-white sm:text-lg"
              >
                {engine}
              </li>
            ))}
          </ul>
        </Reveal>
      </Container>
    </section>
  );
}
