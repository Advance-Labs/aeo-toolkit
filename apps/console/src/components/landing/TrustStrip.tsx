import { Container, Reveal } from '@/components/ui';
import { ENGINES } from './data';

/**
 * Social-proof band naming the AI surfaces the toolkit optimizes for, rendered as a slow,
 * continuously-scrolling marquee (a "logo loop"): the engine wordmarks are duplicated into
 * two adjacent tracks and translated -50%, so the loop is seamless. Edge-fade mask keeps the
 * ends soft. Pure CSS — no third-party logos (license-clean) and no JS — and the static
 * wordmark list is fully present in the HTML for crawlers; the scroll is enhancement-only and
 * pauses for reduced-motion users via the global rule.
 */
export function TrustStrip(): React.ReactElement {
  // Two copies back-to-back so translateX(-50%) lands exactly on the start of the second copy.
  const track = [...ENGINES, ...ENGINES];

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
          <div className="relative w-full overflow-hidden [mask-image:linear-gradient(to_right,transparent,#000_12%,#000_88%,transparent)]">
            <ul className="flex w-max items-center gap-x-12 pr-12 animate-marquee sm:gap-x-16 sm:pr-16">
              {track.map((engine, i) => (
                <li
                  key={`${engine}-${i}`}
                  aria-hidden={i >= ENGINES.length}
                  className="whitespace-nowrap text-base font-semibold text-slate-400 transition-colors duration-200 hover:text-white sm:text-lg"
                >
                  {engine}
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
