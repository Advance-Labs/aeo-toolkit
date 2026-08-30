/** Request/response contract for `POST /api/generate` (shared shape with the route). */
import type { LlmsTxtManifest } from '@advance-labs/types';

export interface GenerateRequest {
  url: string;
  /** When true, also render the expanded `llms-full.txt` variant. */
  full?: boolean;
}

export interface GenerateResponse {
  /** Rendered `llms.txt` (curated links). */
  llmsTxt: string;
  /** Rendered `llms-full.txt`, present only when `full` was requested. */
  llmsFullTxt?: string;
  manifest: LlmsTxtManifest;
  /** Number of HTML pages that contributed to the manifest. */
  pageCount: number;
  /** The normalized root URL that was crawled. */
  url: string;
}

export interface GenerateErrorResponse {
  error: string;
}
