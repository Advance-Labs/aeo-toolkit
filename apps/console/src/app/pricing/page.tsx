import type { JSX } from 'react';
import type { Metadata } from 'next';
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
import { PLANS, PLAN_ORDER } from '@/lib/billing/plans';
import { BILLING_ENABLED } from '@/lib/billing/stripe';
import { getSession } from '@/lib/auth/server';
import {
  SITE_NAME,
  SITE_URL,
  absolute,
  breadcrumbSchema,
  organizationSchema,
  websiteSchema,
} from '@/lib/seo';
import type { Crumb } from '@/lib/seo';
import { PlanCta } from './PlanCta';

export const runtime = 'nodejs';
// Auth state (signed-in?) is read per request from cookies, so this page is dynamic.
export const dynamic = 'force-dynamic';

const PAGE_PATH = '/pricing';
const PAGE_URL = absolute(PAGE_PATH);
const SITE_ORIGIN = SITE_URL.replace(/\/$/, '');
const WEBSITE_ID = `${SITE_ORIGIN}/#website`;

const PAGE_DESCRIPTION =
  'Simple, transparent pricing for the AEO Toolkit. Every tool is free to start — upgrade for higher monthly limits and MCP access for Claude, Cursor, and other AI clients.';

/** Visible breadcrumb trail (Home › Pricing) — mirrored 1:1 into BreadcrumbList JSON-LD. */
const TRAIL: ReadonlyArray<Crumb> = [
  { name: 'Home', path: '/' },
  { name: 'Pricing', path: PAGE_PATH },
];

/** The tier rendered with extra emphasis (the recommended plan). */
const HIGHLIGHT_PLAN = 'pro';

export const metadata: Metadata = {
  title: 'Pricing — Free to start, upgrade for more',
  description: PAGE_DESCRIPTION,
  alternates: { canonical: PAGE_PATH },
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    title: 'AEO Toolkit Pricing',
    description: PAGE_DESCRIPTION,
    url: PAGE_URL,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AEO Toolkit Pricing',
    description: PAGE_DESCRIPTION,
  },
};

/** Render a plan's CTA label from its id. */
function ctaLabel(planName: string, isFree: boolean): string {
  return isFree ? 'Start for free' : `Upgrade to ${planName}`;
}

/**
 * Pricing page. Server component: reads the session (signed-in?) and {@link BILLING_ENABLED} once,
 * renders {@link PLANS} in tier order as cards, and emits Product/Offer + BreadcrumbList JSON-LD so
 * answer engines can resolve the pricing. CTAs are client islands ({@link PlanCta}) that route to
 * Stripe Checkout (signed-in) or `/login` (signed-out); dormant-safe throughout.
 */
export default async function PricingPage(): Promise<JSX.Element> {
  const session = await getSession();
  const signedIn = session !== null;
  const breadcrumb = breadcrumbSchema(TRAIL);

  // OfferCatalog JSON-LD: one Offer per plan so the pricing is machine-readable.
  const offerCatalog = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: `${SITE_NAME} subscription`,
    description: PAGE_DESCRIPTION,
    url: PAGE_URL,
    isPartOf: { '@id': WEBSITE_ID },
    offers: PLAN_ORDER.map((id) => {
      const plan = PLANS[id];
      return {
        '@type': 'Offer',
        name: plan.name,
        price: String(plan.priceUsdMonthly),
        priceCurrency: 'USD',
        description: plan.blurb,
        category: 'subscription',
      };
    }),
  };

  return (
    <>
      <JsonLd data={[organizationSchema(), websiteSchema(), offerCatalog, breadcrumb]} />

      <Section className="pb-8 pt-12 sm:pt-16">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
          <Breadcrumb trail={TRAIL} />
          <Badge tone="cyan">Pricing</Badge>
          <h1 className="max-w-3xl text-balance text-4xl font-semibold leading-[1.08] tracking-tight text-white sm:text-5xl">
            Free to start. <GradientText>Upgrade when you scale.</GradientText>
          </h1>
          <p className="max-w-2xl text-lg leading-relaxed text-slate-300">
            Every tool is free to run today. Paid plans raise your monthly limits and unlock MCP
            access so Claude, Cursor, and other AI clients can call the toolkit directly.
          </p>
          {!BILLING_ENABLED ? (
            <p className="max-w-2xl rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm leading-relaxed text-slate-400">
              Billing isn&rsquo;t enabled on this deployment — every tool is currently free and open
              with no limits. These tiers show the planned pricing.
            </p>
          ) : null}
        </div>
      </Section>

      <Section className="pb-20 pt-4">
        <Container>
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            {PLAN_ORDER.map((id, i) => {
              const plan = PLANS[id];
              const highlighted = id === HIGHLIGHT_PLAN;
              const isFree = id === 'free';
              return (
                <Reveal key={id} delay={i * 0.05}>
                  <SpotlightCard
                    className={
                      highlighted
                        ? 'flex h-full flex-col gap-6 p-7 ring-1 ring-brand-violet/40'
                        : 'flex h-full flex-col gap-6 p-7'
                    }
                  >
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold text-white">{plan.name}</h2>
                        {highlighted ? <Badge tone="violet">Most popular</Badge> : null}
                      </div>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-4xl font-semibold tracking-tight text-white">
                          ${plan.priceUsdMonthly}
                        </span>
                        <span className="text-sm text-slate-400">/ month</span>
                      </div>
                      <p className="text-sm leading-relaxed text-slate-400">{plan.blurb}</p>
                    </div>

                    <ul className="flex flex-1 flex-col gap-2.5">
                      {plan.features.map((feature) => (
                        <li
                          key={feature}
                          className="flex items-start gap-2.5 text-sm leading-relaxed text-slate-300"
                        >
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            className="mt-0.5 shrink-0 text-brand-cyan"
                            aria-hidden="true"
                          >
                            <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>

                    <PlanCta
                      planId={id}
                      label={ctaLabel(plan.name, isFree)}
                      signedIn={signedIn}
                      billingEnabled={BILLING_ENABLED}
                      variant={highlighted ? 'primary' : 'secondary'}
                    />
                  </SpotlightCard>
                </Reveal>
              );
            })}
          </div>

          <p className="mt-8 text-center text-xs leading-relaxed text-slate-500">
            Prices in USD, billed monthly. Cancel anytime from your account.
          </p>
        </Container>
      </Section>
    </>
  );
}
