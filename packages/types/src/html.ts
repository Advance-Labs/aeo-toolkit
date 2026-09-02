/** HTML parsing domain — output of `@advance-labs/html-parser`. */
import type { Url } from './crawl.js';
import type { StructuredDataFormat } from './schema.js';

export interface MetaTags {
  title?: string;
  titleLength: number;
  description?: string;
  descriptionLength: number;
  canonical?: Url;
  /** Raw `<meta name="robots">` content, e.g. "noindex, nofollow". */
  robots?: string;
  viewport?: string;
  charset?: string;
  lang?: string;
  themeColor?: string;
}

export interface OpenGraph {
  title?: string;
  description?: string;
  type?: string;
  url?: Url;
  image?: Url;
  siteName?: string;
  /** True when the core OG quartet (title, description, image, url) is present. */
  complete: boolean;
}

export interface TwitterCard {
  card?: string;
  title?: string;
  description?: string;
  image?: Url;
  site?: string;
}

export interface HeadingNode {
  level: 1 | 2 | 3 | 4 | 5 | 6;
  text: string;
}

export interface ImageInfo {
  src: Url;
  alt?: string;
  /** True only for a NON-EMPTY alt. An `alt=""` is `false` here and `isDecorative` instead. */
  hasAlt: boolean;
  /**
   * The author explicitly marked this image decorative with `alt=""` (ADV-174).
   *
   * Distinct from a missing `alt` attribute, which is an omission. Under WCAG `alt=""` is the
   * PRESCRIBED markup for an image whose meaning is already carried by adjacent text, so it
   * must not be scored as a defect — telling an author to describe it makes the page worse
   * for a screen-reader user.
   */
  isDecorative: boolean;
  width?: number;
  height?: number;
}

export interface LinkInfo {
  href: Url;
  text: string;
  rel?: string;
  internal: boolean;
  nofollow: boolean;
}

/** One `<link rel="alternate" hreflang="…" href="…">` annotation from a page's head. */
export interface HreflangEntry {
  /** The raw hreflang value as authored, e.g. "en-GB" or "x-default" (case preserved). */
  hreflang: string;
  /** The alternate URL, resolved against the page URL. */
  href: Url;
}

/** Content-quality signals used by both technical-SEO and AEO scoring. */
export interface ContentSignals {
  wordCount: number;
  /** FAQ present via heading text or FAQPage schema. */
  hasFaq: boolean;
  hasHowTo: boolean;
  /** Headings phrased as questions — a strong AEO answerability signal. */
  questionHeadingCount: number;
  paragraphCount: number;
  listCount: number;
  tableCount: number;
}

/** A raw structured-data block extracted from HTML, handed to `@advance-labs/schema-validator`. */
export interface RawStructuredDataBlock {
  format: StructuredDataFormat;
  /** JSON-LD: parsed JSON. Microdata/RDFa: extracted item tree. */
  data: unknown;
}

export interface ParsedHtml {
  url: Url;
  meta: MetaTags;
  openGraph: OpenGraph;
  twitter: TwitterCard;
  headings: HeadingNode[];
  /** True when headings descend without skipping levels (h1→h2→h3). */
  headingHierarchyValid: boolean;
  images: ImageInfo[];
  /** Fraction of images that have non-empty alt text, 0..1. */
  imageAltCoverage: number;
  links: LinkInfo[];
  internalLinkCount: number;
  externalLinkCount: number;
  /**
   * `rel="alternate" hreflang` annotations, in document order. Optional so contexts
   * assembled before this field existed remain valid; absent and `[]` both mean
   * "no annotations found".
   */
  hreflangs?: HreflangEntry[];
  content: ContentSignals;
  rawStructuredData: RawStructuredDataBlock[];
}
