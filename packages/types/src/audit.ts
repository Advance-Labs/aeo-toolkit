/** Top-level audit report — output of the LLM/Technical SEO Audit (tool 1) and shared by tools 4 & 5. */
import type { Url } from './crawl.js';
import type { Finding, Score } from './scoring.js';

/** A ready-to-use file generated for something the site is missing. */
export interface GeneratedTemplate {
  /** e.g. "robots.txt", "llms.txt", "sitemap.xml". */
  filename: string;
  contentType: string;
  content: string;
  reason: string;
}

export interface AuditMeta {
  durationMs: number;
  crawler: string;
  version: string;
}

export interface AuditReport {
  url: Url;
  generatedAt: string;
  score: Score;
  pagesCrawled: number;
  /** Prioritized fix list (failed findings, highest-impact first). */
  topFixes: Finding[];
  /** Generated templates for missing files. */
  templates: GeneratedTemplate[];
  meta: AuditMeta;
}
