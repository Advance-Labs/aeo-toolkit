/**
 * Centralized SEO/AEO constants and schema.org JSON-LD builders.
 *
 * The toolkit dogfoods its own advice: it ships machine-readable structured data so answer engines
 * (ChatGPT, Claude, Perplexity, Gemini, Google AI Overviews) can resolve the brand entity and cite
 * the product with confidence. All builders return plain objects to feed into `<JsonLd data={...} />`.
 */

import type { Metadata } from 'next';

/** Canonical origin for the deployed site. Override via `MCP_PUBLIC_URL` in the environment. */
export const SITE_URL = process.env.MCP_PUBLIC_URL ?? 'https://aeo-toolkit-ten.vercel.app';

/** Human-facing brand + publisher metadata, reused across every schema. */
export const SITE_NAME = 'AEO Toolkit';
export const ORG_NAME = 'Advance Labs';
export const ORG_LEGAL_NAME = 'Advance Labs Inc.';
export const REPO_URL = 'https://github.com/Advance-Labs/aeo-toolkit';
export const SITE_TAGLINE = 'Rank in ChatGPT, Claude, Perplexity & AI Overviews';
export const SITE_DESCRIPTION =
  'Open-source toolkit to audit, optimize, and track your visibility across AI answer engines — technical SEO + AEO audits, E-E-A-T scoring, llms.txt generation, GA4/GSC chat, and a 3D backlink graph.';

/** A schema.org node is just a JSON object with an `@type`; never `any`. */
export type SchemaObject = Record<string, unknown>;

/** Absolute URL helper that tolerates a trailing slash on `SITE_URL`. */
export function absolute(path: string): string {
  const base = SITE_URL.replace(/\/$/, '');
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return `${base}${suffix}`;
}

/**
 * Canonical parent for every tool's breadcrumb. The tools are surfaced as the `#tools` section on
 * the landing page (there is no standalone `/tools` index), so both the visible breadcrumb and the
 * `BreadcrumbList` JSON-LD must point here — a bare `/tools` 404s. Defined once so all five tool
 * pages stay consistent.
 */
export const TOOLS_PARENT_PATH = '/#tools';
export const TOOLS_PARENT_URL = absolute(TOOLS_PARENT_PATH);

/** One crumb in a breadcrumb trail: a label and the path it links to. */
export interface Crumb {
  name: string;
  path: string;
}

/**
 * `BreadcrumbList` JSON-LD from a trail of crumbs. Each `path` is resolved to an absolute URL so the
 * structured-data links never dead-end (Google drops breadcrumb rich results whose items 404).
 */
export function breadcrumbSchema(trail: ReadonlyArray<Crumb>): SchemaObject {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: crumb.name,
      item: absolute(crumb.path),
    })),
  };
}

/** Standard `Home › Tools › {tool}` trail used by every tool page (visible nav + JSON-LD). */
export function toolBreadcrumbTrail(toolName: string, toolPath: string): Crumb[] {
  return [
    { name: 'Home', path: '/' },
    { name: 'Tools', path: TOOLS_PARENT_PATH },
    { name: toolName, path: toolPath },
  ];
}

/** Inputs for a tool page's metadata. `title` feeds the `%s — AEO Toolkit` template (keep ≤ ~60
 *  chars incl. suffix); `shareTitle` is the full, standalone title used on social/AI cards. */
export interface ToolMetadataInput {
  path: string;
  title: string;
  description: string;
  shareTitle: string;
  /** Defaults to `description` when omitted. Keep punchy — it's the card subtitle. */
  shareDescription?: string;
}

/**
 * Build a tool page's `Metadata`: canonical + per-page Open Graph **and** Twitter title/description.
 * Card images are wired by each route's `opengraph-image.tsx` (Next's file convention auto-populates
 * both `og:image` and `twitter:image`), so we deliberately don't set `images` here. Twitter does NOT
 * inherit title/description from Open Graph in Next, so we set them explicitly to avoid falling back
 * to the generic site-level card.
 */
export function toolMetadata({
  path,
  title,
  description,
  shareTitle,
  shareDescription,
}: ToolMetadataInput): Metadata {
  const cardDescription = shareDescription ?? description;
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: 'website',
      siteName: SITE_NAME,
      title: shareTitle,
      description: cardDescription,
      url: absolute(path),
    },
    twitter: {
      card: 'summary_large_image',
      title: shareTitle,
      description: cardDescription,
    },
  };
}

/**
 * `Organization` — establishes the publisher entity. `sameAs` links the brand's authoritative
 * profiles so answer engines can disambiguate and trust it.
 */
export function organizationSchema(): SchemaObject {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${SITE_URL.replace(/\/$/, '')}/#organization`,
    name: ORG_NAME,
    legalName: ORG_LEGAL_NAME,
    url: SITE_URL,
    logo: {
      '@type': 'ImageObject',
      url: absolute('/icon.svg'),
      width: 512,
      height: 512,
    },
    description: SITE_DESCRIPTION,
    sameAs: [REPO_URL],
  };
}

/**
 * `WebSite` — names the site and exposes a `SearchAction` (sitelinks search box eligibility +
 * a machine-readable query template answer engines can follow).
 */
export function websiteSchema(): SchemaObject {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${SITE_URL.replace(/\/$/, '')}/#website`,
    name: SITE_NAME,
    url: SITE_URL,
    description: SITE_DESCRIPTION,
    inLanguage: 'en',
    publisher: { '@id': `${SITE_URL.replace(/\/$/, '')}/#organization` },
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${absolute('/tools/audit')}?url={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };
}

/**
 * `SoftwareApplication` — makes the toolkit eligible for product/tool answers. Free, browser-based,
 * categorized as a business application so AEO/SEO tool queries can surface it.
 */
export function softwareApplicationSchema(): SchemaObject {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    '@id': `${SITE_URL.replace(/\/$/, '')}/#software`,
    name: SITE_NAME,
    url: SITE_URL,
    description: SITE_DESCRIPTION,
    applicationCategory: 'BusinessApplication',
    applicationSubCategory: 'SEO & Answer Engine Optimization',
    operatingSystem: 'Web',
    softwareVersion: '0.1.0',
    isAccessibleForFree: true,
    license: `${REPO_URL}/blob/main/LICENSE`,
    publisher: { '@id': `${SITE_URL.replace(/\/$/, '')}/#organization` },
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
    featureList: [
      'Technical SEO + AEO audit',
      'E-E-A-T trust scoring',
      'llms.txt generator',
      'GA4 & Search Console chat',
      '3D backlink graph',
    ],
  };
}
