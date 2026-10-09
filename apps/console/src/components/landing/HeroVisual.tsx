/**
 * Hero artwork: the six signal groups the audit actually scores, as a specimen panel.
 *
 * What this replaces, and why it had to go:
 *
 * The previous version drew an "AEO score" gauge reading **92** — a number with nothing behind
 * it. The source comment said the quiet part out loud: *"Show the arc filled to ~92% for a
 * confident, 'you're winning' read."* A fabricated dashboard figure on the landing page of a
 * product whose entire pitch is auditing whether your claims are citable is the worst possible
 * place to invent a number. "Fake dashboards, invented charts" is a banned pattern for exactly
 * this reason.
 *
 * It also carried the indigo/cyan radial blur, two `animate-float` loops and three `shadow-glow`
 * surfaces — none of which reported any state.
 *
 * This version shows real categories, taken from the scoring engine's own families. Nothing here
 * is invented, so nothing here can go stale in a way that makes us look careless. It is no longer
 * `aria-hidden`: it is content now, not decoration, and an answer engine reading the page gets
 * the same six groups a sighted reader does.
 */
const SIGNAL_GROUPS: ReadonlyArray<{ group: string; detail: string }> = [
  { group: 'Crawlability', detail: 'robots.txt · sitemap · canonicals' },
  { group: 'Metadata', detail: 'title · description · headings' },
  { group: 'Structured data', detail: 'Organization · FAQPage · Article' },
  { group: 'Answer-engine', detail: 'llms.txt · AI-bot rules · extractability' },
  { group: 'Core Web Vitals', detail: 'viewport · tap targets · performance' },
  { group: 'Security & social', detail: 'HTTPS · Open Graph · Twitter cards' },
];

export function HeroVisual(): React.ReactElement {
  return (
    <figure
      className="mx-auto w-full max-w-[440px] rounded-xl border border-rule bg-card"
      aria-labelledby="hero-visual-caption"
    >
      {/* Panel header: a field label, not a sticker. */}
      <div className="flex items-center justify-between border-b border-rule px-4 py-3">
        <span className="font-mono text-xs uppercase tracking-meta text-ink-muted">
          Signal groups
        </span>
        {/* The one place green appears here, and it marks live state rather than decorating. */}
        <span className="flex items-center gap-2 font-mono text-xs uppercase tracking-meta text-pulse">
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-pulse" />
          Scored
        </span>
      </div>

      <dl className="divide-y divide-rule">
        {SIGNAL_GROUPS.map(({ group, detail }) => (
          <div key={group} className="flex flex-col gap-1 px-4 py-3">
            <dt className="text-sm font-medium text-ink">{group}</dt>
            <dd className="font-mono text-xs leading-relaxed text-ink-faint">{detail}</dd>
          </div>
        ))}
      </dl>

      <figcaption id="hero-visual-caption" className="sr-only">
        The six signal groups the AEO audit scores: crawlability, metadata, structured data,
        answer-engine readiness, Core Web Vitals, and security and social tags.
      </figcaption>
    </figure>
  );
}
