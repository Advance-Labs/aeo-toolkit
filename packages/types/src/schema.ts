/** Structured-data domain — output of `@aeo/schema-validator`. */

export type StructuredDataFormat = 'json-ld' | 'microdata' | 'rdfa';

/** schema.org types that matter most for answer engines / AEO. */
export type AeoSchemaType =
  | 'FAQPage'
  | 'QAPage'
  | 'HowTo'
  | 'Article'
  | 'NewsArticle'
  | 'BlogPosting'
  | 'Person'
  | 'Organization'
  | 'BreadcrumbList'
  | 'Product'
  | 'Review'
  | 'AggregateRating'
  | 'LocalBusiness'
  | 'WebSite'
  | 'WebPage'
  | 'Speakable'
  | 'VideoObject'
  | 'Recipe'
  | 'Event';

export interface StructuredDataItem {
  format: StructuredDataFormat;
  /** schema.org type, e.g. "FAQPage". */
  type: string;
  properties: Record<string, unknown>;
  valid: boolean;
  missingRequired: string[];
  warnings: string[];
}

export interface StructuredDataReport {
  items: StructuredDataItem[];
  typesPresent: string[];
  aeoTypesPresent: AeoSchemaType[];
  hasOrganization: boolean;
  hasPerson: boolean;
  hasArticle: boolean;
  hasBreadcrumb: boolean;
  hasFaqOrQa: boolean;
  totalItems: number;
  invalidCount: number;
}
