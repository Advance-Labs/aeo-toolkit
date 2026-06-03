/** Safe JSON parsing utilities used by the provider adapters. */

import type { LlmProvider } from '@aeo/types';
import { LlmResponseError } from './errors.js';

/** Parse a response body to `unknown`, raising a typed error (never a raw SyntaxError) on failure. */
export function parseJson(provider: LlmProvider, body: string): unknown {
  try {
    return JSON.parse(body) as unknown;
  } catch {
    throw new LlmResponseError(provider, 'response body was not valid JSON');
  }
}

/** Narrow `unknown` to a plain record, or `undefined` when it is not object-shaped. */
export function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

/** Read a non-empty string property from a record, or `undefined`. */
export function readString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === 'string' ? value : undefined;
}

/** Read a finite number property from a record, or `undefined`. */
export function readNumber(record: Record<string, unknown>, key: string): number | undefined {
  const value = record[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}
