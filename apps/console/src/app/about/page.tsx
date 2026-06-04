import type { JSX } from 'react';
import type { Metadata } from 'next';
import { Badge, Breadcrumb, Container, GradientText, Reveal, Section, SpotlightCard } from '@/components/ui';
import { JsonLd } from '@/components/seo/JsonLd';
import {
  ORG_LEGAL_NAME,
  ORG_NAME,
  SITE_NAME,
  SITE_URL,
  absolute,
  breadcrumbSchema,
  organizationSchema,
  websiteSchema,
} from '@/lib/seo';
import type { Crumb } from '@/lib/seo';

const PAGE_PATH = '/about';
const PAGE_URL = absolute(PAGE_PATH);
const SITE_ORIGIN = SITE_URL.replace(/\/$/, '');
const ORG_ID = `${SITE_ORIGIN}/#organization`;
const WEBSITE_ID = `${SITE_ORIGIN}/#website`;

const PAGE_DESCRIPTION =
  'Advance Labs is a Canadian software studio that builds open tools for AI search — the team behind the AEO Toolkit and Cartrix.';

/** Visible breadcrumb trail (Home › About) — mirrored 1:1 into BreadcrumbList JSON-LD. */
const TRAIL: ReadonlyArray<Crumb> = [
  { name: 'Home', path: '/' },
  { name: 'About', path: PAGE_PATH },
];

/**
 * About page metadata. Hand-written (not `toolMetadata`) because this is an entity/brand page, not a
 * tool: same shape, but the canonical and Open Graph URLs resolve to `/about`. The layout title
 * template appends ` — AEO Toolkit`, so the title here stays short. The route's `opengraph-image.tsx`
 * supplies both `og:image` and `twitter:image`, so no `images` are set here.
 */
export const metadata: Metadata = {
  title: 'About Advance Labs — The studio behind AEO Toolkit',
  description: PAGE_DESCRIPTION,
  alternates: { canonical: PAGE_PATH },
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    title: 'About Advance Labs — The studio behind AEO Toolkit',
    description: PAGE_DESCRIPTION,
    url: PAGE_URL,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'About Advance Labs — The studio behind AEO Toolkit',
    description: PAGE_DESCRIPTION,
  },
};

/** Answer-first summary an LLM can lift verbatim — who Advance Labs is and what it builds. */
const ANSWER_FIRST =
  'Advance Labs is a Canadian software studio based in Ontario that builds open, practical tools for the age of AI search. It is the team behind the AEO Toolkit — this open-source suite for auditing and optimizing visibility across AI answer engines — and Cartrix.';

/** Products the studio ships — drives the visible "What we build" grid and reads as extractable copy. */
const PRODUCTS: ReadonlyArray<{ name: string; href: string; external: boolean; description: string }> = [
  {
    name: 'AEO Toolkit',
    href: '/',
    external: false,
    description:
      'This site: an open-source suite of tools to audit, optimize, and track your visibility across AI answer engines — technical SEO + AEO audits, E-E-A-T scoring, an llms.txt generator, GA4 + Search Console chat, and a 3D backlink graph. Free and no sign-up.',
  },
  {
    name: 'Cartrix',
    href: 'https://www.cartrix.live/',
    external: true,
    description:
      'A separate Advance Labs product. Like everything we ship, it is built clean-room in TypeScript with a focus on a fast, honest, no-nonsense experience.',
  },
];

/**
 * About Advance Labs page. Server component: ships an answer-first opening, a "What we build"
 * section, a "Who we are" section, a dofollow-linked closing CTA, and structured data
 * (Organization + AboutPage + BreadcrumbList) so answer engines can resolve the brand entity.
 */
export default function AboutPage(): JSX.Element {
  const breadcrumb = breadcrumbSchema(TRAIL);

  const aboutPage = {
    '@context': 'https://schema.org',
    '@type': 'AboutPage',
    name: 'About Advance Labs',
    description: PAGE_DESCRIPTION,
    url: PAGE_URL,
    // Reference the canonical WebSite node (emitted below) so this page joins the site entity graph
    // instead of declaring an orphan inline WebSite.
    isPartOf: { '@id': WEBSITE_ID },
    about: { '@id': ORG_ID },
    mainEntity: { '@id': ORG_ID },
  };

  return (
    <>
      <JsonLd data={[organizationSchema(), websiteSchema(), aboutPage, breadcrumb]} />

      <Section className="pb-8 pt-12 sm:pt-16">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-10">
          <header className="flex flex-col gap-5">
            <Breadcrumb trail={TRAIL} />
            <Badge tone="cyan">About</Badge>
            <h1 className="max-w-3xl text-balance text-4xl font-semibold leading-[1.08] tracking-tight text-white sm:text-5xl">
              The studio behind <GradientText>AEO Toolkit</GradientText>
            </h1>
            <p className="max-w-2xl text-lg leading-relaxed text-slate-300">{ANSWER_FIRST}</p>
          </header>
        </div>
      </Section>

      {/* Mission */}
      <Section className="border-t border-white/[0.06] bg-grid py-16 sm:py-20">
        <Container>
          <Reveal>
            <div className="flex max-w-2xl flex-col gap-3">
              <span className="eyebrow">Our mission</span>
              <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                Open tools for the era of <GradientText>AI search</GradientText>
              </h2>
              <p className="text-base leading-relaxed text-slate-400">
                Search is moving from ten blue links to direct answers from ChatGPT, Claude,
                Perplexity, and Google AI Overviews. Advance Labs builds the tools that help teams
                understand and earn that visibility — in the open, so anyone can inspect, run, and
                trust them.
              </p>
            </div>
          </Reveal>
        </Container>
      </Section>

      {/* What we build */}
      <Section className="border-t border-white/[0.06] py-16 sm:py-20">
        <Container>
          <Reveal>
            <div className="flex max-w-2xl flex-col gap-3">
              <span className="eyebrow">What we build</span>
              <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                Products shipped by <GradientText>Advance Labs</GradientText>
              </h2>
              <p className="text-base leading-relaxed text-slate-400">
                We focus on a small number of products and build each one carefully, clean-room in
                TypeScript.
              </p>
            </div>
          </Reveal>

          <div className="mt-10 grid gap-5 sm:grid-cols-2">
            {PRODUCTS.map((product, i) => (
              <Reveal key={product.name} delay={(i % 2) * 0.05}>
                <SpotlightCard className="h-full p-6">
                  <h3 className="text-base font-semibold text-white">
                    {product.external ? (
                      <a
                        href={product.href}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="transition hover:text-brand-cyan"
                      >
                        {product.name}
                      </a>
                    ) : (
                      product.name
                    )}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-400">{product.description}</p>
                </SpotlightCard>
              </Reveal>
            ))}
          </div>
        </Container>
      </Section>

      {/* Who we are */}
      <Section className="border-t border-white/[0.06] bg-grid py-16 sm:py-20">
        <Container>
          <div className="grid gap-10 lg:grid-cols-[1fr,1.4fr]">
            <Reveal>
              <div className="flex flex-col gap-3 lg:sticky lg:top-24">
                <span className="eyebrow">Who we are</span>
                <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                  A small <GradientText>Canadian studio</GradientText>
                </h2>
              </div>
            </Reveal>

            <Reveal delay={0.05}>
              <div className="surface flex flex-col gap-4 p-6">
                <p className="text-base leading-relaxed text-slate-300">
                  {ORG_LEGAL_NAME} is a software studio based in Ontario, Canada. {ORG_NAME} was
                  founded by{' '}
                  <span className="font-medium text-white">Matthew Krawczak</span> and{' '}
                  <span className="font-medium text-white">Lucas Krawczak</span>, who design, build,
                  and ship every product end to end.
                </p>
                <p className="text-base leading-relaxed text-slate-400">
                  We believe the best tools are open, fast, and honest. The AEO Toolkit is
                  open-source and MIT licensed; you can read the code, run it yourself, and see
                  exactly how every score is calculated.
                </p>
              </div>
            </Reveal>
          </div>
        </Container>
      </Section>

      {/* Closing CTA with dofollow links */}
      <Section className="border-t border-white/[0.06] py-16 sm:py-20">
        <Container>
          <Reveal>
            <SpotlightCard className="mx-auto flex max-w-3xl flex-col items-center gap-6 p-8 text-center sm:p-10">
              <div className="flex flex-col gap-3">
                <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                  Learn more about <GradientText>Advance Labs</GradientText>
                </h2>
                <p className="text-base leading-relaxed text-slate-400">
                  Visit the main site, read the company story, or explore our open-source work on
                  GitHub.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <a
                  href="https://advancelabs.dev"
                  target="_blank"
                  rel="noopener"
                  className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-ink-950 transition hover:bg-slate-200"
                >
                  advancelabs.dev
                </a>
                <a
                  href="https://advancelabs.dev/about"
                  target="_blank"
                  rel="noopener"
                  className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-5 py-2.5 text-sm font-semibold text-white transition hover:border-white/30 hover:bg-white/[0.08]"
                >
                  About Advance Labs
                </a>
                <a
                  href="https://github.com/Advance-Labs"
                  target="_blank"
                  rel="noopener"
                  className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-5 py-2.5 text-sm font-semibold text-white transition hover:border-white/30 hover:bg-white/[0.08]"
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path d="M12 .5C5.73.5.5 5.73.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56 0-.27-.01-1.16-.02-2.1-3.2.7-3.88-1.36-3.88-1.36-.52-1.33-1.28-1.69-1.28-1.69-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.8 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.84 1.19 3.1 0 4.42-2.69 5.39-5.25 5.68.41.36.78 1.07.78 2.16 0 1.56-.01 2.82-.01 3.2 0 .31.21.68.8.56A11.51 11.51 0 0 0 23.5 12C23.5 5.73 18.27.5 12 .5Z" />
                  </svg>
                  GitHub
                </a>
              </div>
            </SpotlightCard>
          </Reveal>
        </Container>
      </Section>
    </>
  );
}
