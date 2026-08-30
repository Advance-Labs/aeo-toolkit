/** Scoring domain — the keystone shapes produced by `@advance-labs/scoring`. */
import type { Url } from './crawl.js';
import type { CrawlResult } from './crawl.js';
import type { ParsedHtml } from './html.js';
import type { StructuredDataReport } from './schema.js';

export type FindingSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export type ScoreCategoryKey =
  | 'crawlability'
  | 'indexing'
  | 'metadata'
  | 'structured-data'
  | 'content'
  | 'aeo'
  | 'mobile'
  | 'security'
  | 'social';

export type ScoreGrade = 'A' | 'B' | 'C' | 'D' | 'F';

/** A single evaluated rule result, shown in the prioritized fix list. */
export interface Finding {
  id: string;
  category: ScoreCategoryKey;
  severity: FindingSeverity;
  title: string;
  description: string;
  recommendation: string;
  passed: boolean;
  weight: number;
  affectedUrls?: Url[];
  docsUrl?: string;
}

export interface ScoreCategory {
  key: ScoreCategoryKey;
  label: string;
  /** 0..100 score for this category. */
  score: number;
  /** Contribution weight to the overall score. */
  weight: number;
  findings: Finding[];
  passedCount: number;
  failedCount: number;
}

export interface Score {
  /** 0..100 overall score. */
  overall: number;
  grade: ScoreGrade;
  categories: ScoreCategory[];
  passedCount: number;
  failedCount: number;
  criticalCount: number;
}

export type ScoringMode = 'full-site' | 'single-page';

/** Everything a rule needs to make a pass/fail decision. */
export interface ScoringContext {
  crawl: CrawlResult;
  pages: ParsedHtml[];
  structuredData: StructuredDataReport[];
  mode: ScoringMode;
}

export interface RuleOutcome {
  passed: boolean;
  affectedUrls?: Url[];
  detail?: string;
}

/** A declarative, weighted scoring rule. `evaluate` returns true when the rule PASSES. */
export interface Rule<TContext = ScoringContext> {
  id: string;
  category: ScoreCategoryKey;
  severity: FindingSeverity;
  weight: number;
  title: string;
  description: string;
  recommendation: string;
  docsUrl?: string;
  evaluate: (ctx: TContext) => RuleOutcome | Promise<RuleOutcome>;
}
