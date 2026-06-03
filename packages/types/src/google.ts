/** Google data domain — shapes for `@aeo/google-api` (GA4 + Search Console). */

export interface Ga4Property {
  propertyId: string;
  displayName: string;
}

export interface GscSite {
  siteUrl: string;
  permissionLevel: string;
}

export interface DateRange {
  startDate: string;
  endDate: string;
}

export interface Ga4ReportRequest {
  propertyId: string;
  dateRanges: DateRange[];
  dimensions: string[];
  metrics: string[];
  limit?: number;
}

export interface Ga4Row {
  dimensions: Record<string, string>;
  metrics: Record<string, number>;
}

export interface Ga4Report {
  rows: Ga4Row[];
  rowCount: number;
}

export type GscDimension = 'query' | 'page' | 'country' | 'device' | 'date' | 'searchAppearance';

export interface GscQueryRequest {
  siteUrl: string;
  startDate: string;
  endDate: string;
  dimensions?: GscDimension[];
  rowLimit?: number;
}

export interface GscRow {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface GscReport {
  rows: GscRow[];
}

export interface GoogleOAuthTokens {
  accessToken: string;
  refreshToken?: string;
  /** Unix ms expiry. */
  expiresAt: number;
  scope: string;
}

/** Pluggable encrypted token storage (Supabase adapter in production). */
export interface TokenStore {
  get(userId: string): Promise<GoogleOAuthTokens | null>;
  set(userId: string, tokens: GoogleOAuthTokens): Promise<void>;
  delete(userId: string): Promise<void>;
}
