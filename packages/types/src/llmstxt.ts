/** llms.txt domain — output of the llms.txt Generator (tool 3). */
import type { Url } from './crawl.js';

export interface LlmsTxtEntry {
  title: string;
  url: Url;
  description?: string;
}

export interface LlmsTxtSection {
  /** Section heading, e.g. "Docs", "Blog", "Optional". */
  heading: string;
  entries: LlmsTxtEntry[];
}

/** Structured model of an llms.txt file, per the emerging llmstxt.org spec. */
export interface LlmsTxtManifest {
  siteName: string;
  /** Blockquote summary line under the H1. */
  summary?: string;
  /** Free-form details paragraph(s). */
  details?: string;
  sections: LlmsTxtSection[];
  contact?: string;
  license?: string;
}

export interface LlmsTxtOutput {
  /** Rendered `llms.txt` (curated links). */
  llmsTxt: string;
  /** Rendered `llms-full.txt` (expanded full-content variant), when requested. */
  llmsFullTxt?: string;
  manifest: LlmsTxtManifest;
}
