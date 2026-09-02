import type { JSX } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Badge, Breadcrumb, Container, GradientText, Section } from '@/components/ui';
import { JsonLd } from '@/components/seo/JsonLd';
import { SITE_NAME, breadcrumbSchema, publicUrl } from '@/lib/seo';
import type { Crumb } from '@/lib/seo';
import { GLOSSARY_TERMS, glossaryTerm } from '@/content/glossary';

/** All term pages are statically generated; unknown slugs 404 rather than render on demand. */
export const dynamicParams = false;

export function generateStaticParams(): Array<{ slug: string }> {
  return GLOSSARY_TERMS.map((term) => ({ slug: term.slug }));
}

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const term = glossaryTerm(slug);
  if (!term) return {};
  const path = `/glossary/${term.slug}`;
  const shareTitle = `${term.question} — ${SITE_NAME} Glossary`;
  return {
    title: term.question,
    description: term.metaDescription,
    alternates: { canonical: path },
    openGraph: {
      type: 'article',
      siteName: SITE_NAME,
      title: shareTitle,
      description: term.metaDescription,
      url: publicUrl(path),
    },
    twitter: { card: 'summary_large_image', title: shareTitle, description: term.metaDescription },
  };
}

/**
 * Glossary term page (#35): a definitional answer page. The h1 is the question, the first
 * paragraph is the liftable definition, and the JSON-LD (DefinedTerm + WebPage + optional
 * FAQPage) mirrors the visible content 1:1 so engines never see claims the page doesn't make.
 */
export default async function GlossaryTermPage({ params }: PageProps): Promise<JSX.Element> {
  const { slug } = await params;
  const term = glossaryTerm(slug);
  if (!term) notFound();

  const path = `/glossary/${term.slug}`;
  const trail: ReadonlyArray<Crumb> = [
    { name: 'Home', path: '/' },
    { name: 'Glossary', path: '/glossary' },
    { name: term.term, path },
  ];

  const jsonLd: Record<string, unknown>[] = [
    breadcrumbSchema(trail),
    {
      '@context': 'https://schema.org',
      '@type': 'DefinedTerm',
      '@id': publicUrl(path),
      name: term.term,
      description: term.definition,
      url: publicUrl(path),
      inDefinedTermSet: `${publicUrl('/glossary')}#terms`,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: term.question,
      description: term.metaDescription,
      url: publicUrl(path),
      about: term.definition,
    },
  ];
  if (term.faq && term.faq.length > 0) {
    jsonLd.push({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: term.faq.map((item) => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: { '@type': 'Answer', text: item.answer },
      })),
    });
  }

  const related = term.related
    .map((relatedSlug) => glossaryTerm(relatedSlug))
    .filter((t): t is NonNullable<typeof t> => t !== undefined);

  return (
    <>
      <JsonLd data={jsonLd} />

      <Section className="pb-8 pt-12 sm:pt-16">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-10">
          <header className="flex flex-col gap-5">
            <Breadcrumb trail={trail} />
            <Badge tone="cyan">Glossary</Badge>
            <h1 className="max-w-3xl text-balance text-4xl font-semibold leading-[1.08] tracking-tight text-white sm:text-5xl">
              {term.question.replace(/\?$/, '')}
              <GradientText>?</GradientText>
            </h1>
            {/* The liftable definition — the exact snippet an answer engine should quote. */}
            <p className="max-w-2xl text-lg leading-relaxed text-slate-300">{term.definition}</p>
          </header>
        </div>
      </Section>

      <Section className="border-t border-white/[0.06] py-16 sm:py-20">
        <Container>
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
            {term.body.map((paragraph) => (
              <p key={paragraph.slice(0, 40)} className="text-base leading-relaxed text-slate-300">
                {paragraph}
              </p>
            ))}

            {/* Put the concept to work — the cluster's link into the tools. */}
            <div className="mt-4 flex flex-wrap gap-3">
              {term.tools.map((tool) => (
                <Link
                  key={tool.href}
                  href={tool.href}
                  className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-medium text-brand-cyan transition-colors hover:border-white/20"
                >
                  {tool.label} →
                </Link>
              ))}
            </div>
          </div>
        </Container>
      </Section>

      {term.faq && term.faq.length > 0 ? (
        <Section className="border-t border-white/[0.06] py-16 sm:py-20">
          <Container>
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
              <h2 className="text-2xl font-semibold tracking-tight text-white">Common questions</h2>
              <div className="flex flex-col gap-3">
                {term.faq.map((item) => (
                  <details
                    key={item.question}
                    className="surface group p-5 [&_summary::-webkit-details-marker]:hidden"
                  >
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-base font-medium text-white">
                      {item.question}
                      <span
                        aria-hidden
                        className="shrink-0 text-slate-400 transition-transform duration-200 group-open:rotate-45"
                      >
                        +
                      </span>
                    </summary>
                    <p className="mt-3 text-sm leading-relaxed text-slate-400">{item.answer}</p>
                  </details>
                ))}
              </div>
            </div>
          </Container>
        </Section>
      ) : null}

      {related.length > 0 ? (
        <Section className="border-t border-white/[0.06] py-12">
          <Container>
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
                Related terms
              </h2>
              <div className="flex flex-wrap gap-3">
                {related.map((relatedTerm) => (
                  <Link
                    key={relatedTerm.slug}
                    href={`/glossary/${relatedTerm.slug}`}
                    className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5 text-sm text-slate-300 transition-colors hover:border-white/20 hover:text-white"
                  >
                    {relatedTerm.term}
                  </Link>
                ))}
              </div>
            </div>
          </Container>
        </Section>
      ) : null}
    </>
  );
}
