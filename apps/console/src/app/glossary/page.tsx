import type { JSX } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Badge,
  Breadcrumb,
  Container,
  GradientText,
  Reveal,
  Section,
  SpotlightCard,
} from '@/components/ui';
import { JsonLd } from '@/components/seo/JsonLd';
import { SITE_NAME, absolute, breadcrumbSchema, publicUrl } from '@/lib/seo';
import type { Crumb } from '@/lib/seo';
import { GLOSSARY_TERMS } from '@/content/glossary';

const PAGE_PATH = '/glossary';
const PAGE_TITLE = 'AEO & AI Search Glossary';
const PAGE_DESCRIPTION =
  'Plain-language definitions of the AEO and AI-search terms that matter — answer engines, llms.txt, E-E-A-T, AI citations, and more.';

const TRAIL: ReadonlyArray<Crumb> = [
  { name: 'Home', path: '/' },
  { name: 'Glossary', path: PAGE_PATH },
];

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: PAGE_PATH },
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    title: `${PAGE_TITLE} — ${SITE_NAME}`,
    description: PAGE_DESCRIPTION,
    url: absolute(PAGE_PATH),
  },
  twitter: {
    card: 'summary_large_image',
    title: `${PAGE_TITLE} — ${SITE_NAME}`,
    description: PAGE_DESCRIPTION,
  },
};

/**
 * Glossary index (#35): the hub of the definitional topic cluster. Every term card leads with
 * the liftable definition so the index itself reads as an extractable reference, and the
 * `DefinedTermSet` JSON-LD mirrors the visible list 1:1.
 */
export default function GlossaryIndexPage(): JSX.Element {
  const definedTermSet = {
    '@context': 'https://schema.org',
    '@type': 'DefinedTermSet',
    '@id': `${publicUrl(PAGE_PATH)}#terms`,
    name: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: publicUrl(PAGE_PATH),
    hasDefinedTerm: GLOSSARY_TERMS.map((term) => ({
      '@type': 'DefinedTerm',
      '@id': publicUrl(`/glossary/${term.slug}`),
      name: term.term,
      description: term.definition,
      url: publicUrl(`/glossary/${term.slug}`),
    })),
  };

  return (
    <>
      <JsonLd data={[breadcrumbSchema(TRAIL), definedTermSet]} />

      <Section className="pb-8 pt-12 sm:pt-16">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-10">
          <header className="flex flex-col gap-5">
            <Breadcrumb trail={TRAIL} />
            <Badge tone="cyan">Glossary</Badge>
            <h1 className="max-w-3xl text-balance text-4xl font-semibold leading-[1.08] tracking-tight text-white sm:text-5xl">
              The language of <GradientText>AI search</GradientText>, defined
            </h1>
            <p className="max-w-2xl text-lg leading-relaxed text-slate-300">{PAGE_DESCRIPTION}</p>
          </header>
        </div>
      </Section>

      <Section className="border-t border-white/[0.06] bg-grid py-16 sm:py-20">
        <Container>
          <div className="grid gap-5 sm:grid-cols-2">
            {GLOSSARY_TERMS.map((term, i) => (
              <Reveal key={term.slug} delay={(i % 2) * 0.05}>
                <Link href={`/glossary/${term.slug}`} className="block h-full">
                  <SpotlightCard className="h-full p-6">
                    <h2 className="text-base font-semibold text-white">{term.term}</h2>
                    <p className="mt-2 text-sm leading-relaxed text-slate-400">{term.definition}</p>
                    <span className="mt-3 inline-block text-sm font-medium text-brand-cyan">
                      Read the full definition →
                    </span>
                  </SpotlightCard>
                </Link>
              </Reveal>
            ))}
          </div>
        </Container>
      </Section>
    </>
  );
}
