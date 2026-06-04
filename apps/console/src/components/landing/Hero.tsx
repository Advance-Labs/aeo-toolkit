import { Badge, Button, Container, GradientText, Reveal } from '@/components/ui';
import { HeroVisual } from './HeroVisual';

/**
 * Above-the-fold hero. Renders the single page `<h1>`, the primary/secondary CTAs,
 * a thin trust line, and the decorative score-gauge visual. Server component — the
 * only motion comes from `Reveal` (a client island) and CSS animations.
 */
export function Hero(): React.ReactElement {
  return (
    <section className="relative overflow-hidden pb-16 pt-20 sm:pb-24 sm:pt-28">
      <Container>
        <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-8">
          <Reveal className="flex flex-col items-start gap-6">
            <Badge tone="cyan">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-cyan" />
              Answer Engine Optimization
            </Badge>

            <h1 className="max-w-2xl text-balance text-4xl font-semibold leading-[1.05] tracking-tight text-white sm:text-5xl md:text-6xl">
              Get cited by <GradientText>ChatGPT, Claude &amp; Perplexity.</GradientText>
            </h1>

            <p className="max-w-xl text-pretty text-lg leading-relaxed text-slate-400">
              AEO Toolkit audits, optimizes, and tracks your visibility across AI answer engines —
              technical SEO + AEO scoring, E-E-A-T scanning, llms.txt generation, and a live
              backlink graph, all in one console.
            </p>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button href="/tools/audit" size="lg">
                Run a free audit
                <ArrowRight />
              </Button>
              <Button href="#tools" variant="secondary" size="lg">
                Explore the tools
              </Button>
            </div>

            <p className="flex items-center gap-2 text-sm text-slate-400">
              <CheckIcon />
              Free to start · No account required · five tools, one console
            </p>
          </Reveal>

          <Reveal delay={0.15} className="order-first lg:order-last">
            <HeroVisual />
          </Reveal>
        </div>
      </Container>
    </section>
  );
}

function ArrowRight(): React.ReactElement {
  return (
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
  );
}

function CheckIcon(): React.ReactElement {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden
      className="h-4 w-4 text-brand-cyan"
    >
      <path d="m5 12 4 4 10-10" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
