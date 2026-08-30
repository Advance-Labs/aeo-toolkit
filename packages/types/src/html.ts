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
  hasAlt: boolean;
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
  /** Number of `<script>` elements on the page. */
  scriptCount: number;
  /**
   * True when a known single-page-app mount point (`#root`, `#app`, `#__next`, a React root)
   * is present but contains no visible text.
   *
   * This is the fingerprint of client-side rendering: the served HTML is an empty shell and
   * the content only exists after JavaScript runs. It matters for AEO because answer engines
   * and most AI crawlers read the HTML they are served and do not execute JavaScript, so that
   * content is invisible to them no matter how good it is in a browser.
   */
  hasEmptyAppShell: boolean;
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
  content: ContentSignals;
  rawStructuredData: RawStructuredDataBlock[];
}
