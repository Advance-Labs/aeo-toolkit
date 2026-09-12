/**
 * Shared tool context + small helpers used by every GA4/GSC tool handler.
 *
 * Tools are written as pure-ish functions over an injected {@link ToolContext} so
 * they can be unit-tested with a mocked `@advance-labs/google-api` client factory and a
 * fake token resolver — no live network, no global state.
 */
import { BingWebmasterClient } from '@advance-labs/bing-api';
import { Ga4Client, GscClient } from '@advance-labs/google-api';
import type { GscDimension } from '@advance-labs/types';
import type { BingKeyResolver } from '../auth/bing.js';
import type { TokenResolver } from '../auth/google.js';
import { DEFAULT_USER_ID } from '../auth/google.js';

/** Minimal structural surface of the GA4 client a tool needs (for mocking). */
export interface Ga4Like {
  runReport: Ga4Client['runReport'];
  listProperties: Ga4Client['listProperties'];
}

/** Minimal structural surface of the GSC client a tool needs (for mocking). */
export interface GscLike {
  query: GscClient['query'];
  listSites: GscClient['listSites'];
}

/** Minimal structural surface of the Bing client a tool needs (for mocking). */
export interface BingLike {
  listSites: BingWebmasterClient['listSites'];
  getRankAndTrafficStats: BingWebmasterClient['getRankAndTrafficStats'];
  getQueryStats: BingWebmasterClient['getQueryStats'];
  getPageStats: BingWebmasterClient['getPageStats'];
  getQueryPageStats: BingWebmasterClient['getQueryPageStats'];
  getPageQueryStats: BingWebmasterClient['getPageQueryStats'];
  getCrawlStats: BingWebmasterClient['getCrawlStats'];
  getCrawlIssues: BingWebmasterClient['getCrawlIssues'];
  getUrlInfo: BingWebmasterClient['getUrlInfo'];
  getUrlSubmissionQuota: BingWebmasterClient['getUrlSubmissionQuota'];
  getKeywordStats: BingWebmasterClient['getKeywordStats'];
  getRelatedKeywords: BingWebmasterClient['getRelatedKeywords'];
}

/** Builds Google/Bing clients bound to a resolved credential. Swappable in tests. */
export interface ClientFactory {
  ga4(accessToken: string): Ga4Like;
  gsc(accessToken: string): GscLike;
  bing(apiKey: string): BingLike;
}

/** The real factory: constructs the live `@advance-labs/google-api` and `@advance-labs/bing-api` clients. */
export const defaultClientFactory: ClientFactory = {
  ga4: (accessToken) => new Ga4Client({ accessToken }),
  gsc: (accessToken) => new GscClient({ accessToken }),
  bing: (apiKey) => new BingWebmasterClient({ apiKey }),
};

/**
 * Everything a tool handler needs: how to resolve a token, how to build clients,
 * the current user id, and the optional request-scoped BYOK bearer token.
 */
export interface ToolContext {
  tokens: TokenResolver;
  bingKeys: BingKeyResolver;
  clients: ClientFactory;
  userId: string;
  /** Request-scoped bearer token (BYOK); never persisted, never logged. */
  requestToken?: string | null;
  /** Request-scoped Bing API key (BYOK); never persisted, never logged. */
  requestBingKey?: string | null;
}

/** Resolve a token and build a GA4 client in one step. */
export async function ga4For(ctx: ToolContext): Promise<Ga4Like> {
  const token = await ctx.tokens.resolveAccessToken(ctx.userId, ctx.requestToken);
  return ctx.clients.ga4(token);
}

/** Resolve a token and build a GSC client in one step. */
export async function gscFor(ctx: ToolContext): Promise<GscLike> {
  const token = await ctx.tokens.resolveAccessToken(ctx.userId, ctx.requestToken);
  return ctx.clients.gsc(token);
}

/** Resolve a Bing API key and build a client in one step. */
export async function bingFor(ctx: ToolContext): Promise<BingLike> {
  const apiKey = await ctx.bingKeys.resolveApiKey(ctx.userId, ctx.requestBingKey);
  return ctx.clients.bing(apiKey);
}

/** A default context bound to the single local user (no per-request override). */
export function baseContext(
  tokens: TokenResolver,
  bingKeys: BingKeyResolver,
  clients: ClientFactory,
): ToolContext {
  return {
    tokens,
    bingKeys,
    clients,
    userId: DEFAULT_USER_ID,
    requestToken: null,
    requestBingKey: null,
  };
}

/** The set of GSC dimensions the API accepts; used to validate caller input. */
export const GSC_DIMENSIONS: readonly GscDimension[] = [
  'query',
  'page',
  'country',
  'device',
  'date',
  'searchAppearance',
];
