/**
 * @aeo/types — the single source of truth for cross-package domain types.
 *
 * Every package imports its shared shapes from here. Never redefine a type that lives in this package.
 */
export type * from './crawl.js';
export type * from './html.js';
export type * from './schema.js';
export type * from './scoring.js';
export type * from './audit.js';
export type * from './eeat.js';
export type * from './llmstxt.js';
export type * from './google.js';
export type * from './llm.js';
export type * from './mcp.js';

/** Toolkit-wide version marker, surfaced in report metadata. */
export const TYPES_VERSION = '0.1.0';
