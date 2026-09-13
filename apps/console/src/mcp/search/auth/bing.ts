/**
 * API-key resolution for the Bing Webmaster tools.
 *
 * Mirrors `TokenResolver`'s POLICY — request-scoped credential wins, then the
 * store, then the environment — while sharing none of its implementation. A Bing
 * API key has no refresh, no expiry, and no skew, so inheriting the OAuth machinery
 * would import four concepts Bing does not have.
 *
 * The request-scoped key is returned verbatim: never written to the store, never
 * logged, never included in a thrown message.
 */
import { McpToolError } from '@advance-labs/mcp-core';

/** Durable store for per-user Bing API keys. */
export interface BingKeyStore {
  get(userId: string): Promise<string | null>;
}

/** Process-local store. Single-instance / local-dev only. */
export class InMemoryBingKeyStore implements BingKeyStore {
  private readonly keys = new Map<string, string>();

  async get(userId: string): Promise<string | null> {
    return this.keys.get(userId) ?? null;
  }

  async set(userId: string, apiKey: string): Promise<void> {
    this.keys.set(userId, apiKey);
  }
}

export interface BingKeyResolverOptions {
  store: BingKeyStore;
  /** Env-supplied key for single-user local dev; used only when the store is empty. */
  staticApiKey?: string | null;
}

/** Trim to a non-empty string, or `null`. */
function usable(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export class BingKeyResolver {
  private readonly store: BingKeyStore;
  private readonly staticApiKey: string | null;

  constructor(opts: BingKeyResolverOptions) {
    this.store = opts.store;
    this.staticApiKey = usable(opts.staticApiKey);
  }

  /**
   * Resolve a usable Bing API key for `userId`.
   *
   * @param requestKey a request-scoped key (from the `X-Bing-Api-Key` header);
   *   when present it wins and is never persisted.
   * @throws {McpToolError} when no credential is available from any source.
   */
  async resolveApiKey(userId: string, requestKey?: string | null): Promise<string> {
    const fromRequest = usable(requestKey);
    if (fromRequest !== null) return fromRequest;

    const fromStore = usable(await this.store.get(userId));
    if (fromStore !== null) return fromStore;

    if (this.staticApiKey !== null) return this.staticApiKey;

    throw new McpToolError(
      'No Bing Webmaster API key available. Send one in the X-Bing-Api-Key header, ' +
        'or set BING_API_KEY in the environment. Google tools are unaffected.',
      'bing_credential_missing',
    );
  }
}
