/**
 * Shared tool context + small helpers used by every GA4/GSC tool handler.
 *
 * Tools are written as pure-ish functions over an injected {@link ToolContext} so
 * they can be unit-tested with a mocked `@aeo/google-api` client factory and a
 * fake token resolver — no live network, no global state.
 */
import { Ga4Client, GscClient } from '@aeo/google-api';
import type { GscDimension } from '@aeo/types';
import type { TokenResolver } from '../auth.js';
import { DEFAULT_USER_ID } from '../auth.js';

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

/** Builds Google clients bound to a resolved access token. Swappable in tests. */
export interface ClientFactory {
  ga4(accessToken: string): Ga4Like;
  gsc(accessToken: string): GscLike;
}

/** The real factory: constructs the live `@aeo/google-api` clients. */
export const defaultClientFactory: ClientFactory = {
  ga4: (accessToken) => new Ga4Client({ accessToken }),
  gsc: (accessToken) => new GscClient({ accessToken }),
};

/**
 * Everything a tool handler needs: how to resolve a token, how to build clients,
 * the current user id, and the optional request-scoped BYOK bearer token.
 */
export interface ToolContext {
  tokens: TokenResolver;
  clients: ClientFactory;
  userId: string;
  /** Request-scoped bearer token (BYOK); never persisted, never logged. */
  requestToken?: string | null;
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

/** A default context bound to the single local user (no per-request override). */
export function baseContext(tokens: TokenResolver, clients: ClientFactory): ToolContext {
  return { tokens, clients, userId: DEFAULT_USER_ID, requestToken: null };
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
