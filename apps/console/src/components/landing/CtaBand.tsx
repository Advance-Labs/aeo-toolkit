import { Button, Container, Reveal } from '@/components/ui';

/**
 * Closing call-to-action band — a gradient-bordered glass panel with the radial brand
 * glow, the headline promise, and the primary "run audit" CTA. Last thing before the
 * global footer.
 */
export function CtaBand(): React.ReactElement {
  return (
    <section className="pb-24 pt-8" aria-label="Get started">
      <Container>
        <Reveal>
          <div className="relative overflow-hidden rounded-xl border border-rule bg-card px-6 py-14 text-center sm:px-12 sm:py-20">
            {/* Inner glow + grid texture. */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-px bg-rule-strong"
            />
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-grid-fade [background-size:48px_48px] [mask-image:radial-gradient(ellipse_70%_70%_at_50%_50%,#000,transparent_75%)] opacity-40"
            />

            <div className="relative mx-auto flex max-w-2xl flex-col items-center gap-6">
              <h2 className="text-balance text-3xl font-semibold tracking-tight text-white sm:text-4xl md:text-[2.75rem]">
                Start ranking in AI search
              </h2>
              <p className="text-pretty text-lg text-slate-300">
                Run a free audit and see exactly what it takes for ChatGPT, Claude, Perplexity, and
                Google AI Overviews to cite your site.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button href="/tools/audit" size="lg">
                  Run a free audit
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
                </Button>
                <Button href="#tools" variant="secondary" size="lg">
                  Browse all tools
                </Button>
              </div>
            </div>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
