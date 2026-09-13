import type { JSX } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Badge, Breadcrumb, Container, GradientText, Section } from '@/components/ui';
import { JsonLd } from '@/components/seo/JsonLd';
import { SITE_NAME, breadcrumbSchema, publicUrl } from '@/lib/seo';
import type { Crumb } from '@/lib/seo';
import { COMPARISONS, comparison } from '@/content/compare';

/** All comparison pages are statically generated; unknown slugs 404. */
export const dynamicParams = false;

export function generateStaticParams(): Array<{ slug: string }> {
  return COMPARISONS.map((entry) => ({ slug: entry.slug }));
}

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const entry = comparison(slug);
  if (!entry) return {};
  const path = `/compare/${entry.slug}`;
  const shareTitle = `${entry.title} — ${SITE_NAME}`;
  return {
    title: entry.metaTitle,
    description: entry.metaDescription,
    alternates: { canonical: path },
    openGraph: {
      type: 'article',
      siteName: SITE_NAME,
      title: shareTitle,
      description: entry.metaDescription,
      url: publicUrl(path),
    },
    twitter: { card: 'summary_large_image', title: shareTitle, description: entry.metaDescription },
  };
}

/**
 * Comparison page (#36): verdict first, then a real `<table>` (the shape LLMs extract most
 * cleanly), then when-to-choose-which. FAQPage JSON-LD mirrors the visible FAQ 1:1.
 */
export default async function ComparisonPage({ params }: PageProps): Promise<JSX.Element> {
  const { slug } = await params;
  const entry = comparison(slug);
  if (!entry) notFound();

  const path = `/compare/${entry.slug}`;
  const trail: ReadonlyArray<Crumb> = [
    { name: 'Home', path: '/' },
    { name: entry.title, path },
  ];

  const jsonLd: Record<string, unknown>[] = [
    breadcrumbSchema(trail),
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: entry.metaTitle,
      description: entry.metaDescription,
      url: publicUrl(path),
      about: entry.verdict,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: entry.faq.map((item) => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: { '@type': 'Answer', text: item.answer },
      })),
    },
  ];

  return (
    <>
      <JsonLd data={jsonLd} />

      <Section className="pb-8 pt-12 sm:pt-16">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-10">
          <header className="flex flex-col gap-5">
            <Breadcrumb trail={trail} />
            <Badge tone="cyan">Comparison</Badge>
            <h1 className="max-w-3xl text-balance text-4xl font-semibold leading-[1.08] tracking-tight text-white sm:text-5xl">
              {entry.title.split(' vs ')[0]} vs{' '}
              <GradientText>{entry.title.split(' vs ')[1]}</GradientText>
            </h1>
            {/* The liftable verdict — what an engine should quote for "X vs Y". */}
            <p className="max-w-2xl text-lg leading-relaxed text-slate-300">{entry.verdict}</p>
          </header>
        </div>
      </Section>

      {/* The comparison table — semantic HTML, scrollable on small screens. */}
      <Section className="border-t border-white/[0.06] bg-grid py-16 sm:py-20">
        <Container>
          <div className="mx-auto w-full max-w-4xl overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left text-sm">
              <caption className="sr-only">{entry.title}, dimension by dimension</caption>
              <thead>
                <tr className="border-b border-white/15">
                  <th scope="col" className="py-3 pr-4 font-semibold text-slate-400">
                    Dimension
                  </th>
                  <th scope="col" className="py-3 pr-4 font-semibold text-white">
                    {entry.columns.a}
                  </th>
                  <th scope="col" className="py-3 font-semibold text-white">
                    {entry.columns.b}
                  </th>
                </tr>
              </thead>
              <tbody>
                {entry.rows.map((row) => (
                  <tr key={row.dimension} className="border-b border-white/[0.06] align-top">
                    <th scope="row" className="py-4 pr-4 font-medium text-slate-300">
                      {row.dimension}
                    </th>
                    <td className="py-4 pr-4 leading-relaxed text-slate-400">{row.a}</td>
                    <td className="py-4 leading-relaxed text-slate-400">{row.b}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Container>
      </Section>

      <Section className="border-t border-white/[0.06] py-16 sm:py-20">
        <Container>
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
            {entry.body.map((paragraph) => (
              <p key={paragraph.slice(0, 40)} className="text-base leading-relaxed text-slate-300">
                {paragraph}
              </p>
            ))}

            <div className="mt-2 grid gap-5 sm:grid-cols-2">
              <div className="surface p-5">
                <h2 className="text-sm font-semibold text-white">
                  When to prioritize {entry.columns.a.split(' (')[0]}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{entry.chooseA}</p>
              </div>
              <div className="surface p-5">
                <h2 className="text-sm font-semibold text-white">
                  When to prioritize {entry.columns.b.split(' (')[0]}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{entry.chooseB}</p>
              </div>
            </div>
          </div>
        </Container>
      </Section>

      <Section className="border-t border-white/[0.06] py-16 sm:py-20">
        <Container>
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
            <h2 className="text-2xl font-semibold tracking-tight text-white">Common questions</h2>
            <div className="flex flex-col gap-3">
              {entry.faq.map((item) => (
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

            <div className="mt-2 flex flex-wrap gap-3">
              {entry.related.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5 text-sm text-slate-300 transition-colors hover:border-white/20 hover:text-white"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        </Container>
      </Section>
    </>
  );
}
