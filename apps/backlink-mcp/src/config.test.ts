import { describe, it, expect } from 'vitest';
import { resolveConfig, DEFAULT_USER_AGENT, SERVER_NAME } from './config.js';

describe('resolveConfig', () => {
  it('applies polite defaults when env is empty', () => {
    const config = resolveConfig({});
    expect(config.name).toBe(SERVER_NAME);
    expect(config.userAgent).toBe(DEFAULT_USER_AGENT);
    expect(config.rateLimit.capacity).toBeGreaterThan(0);
    expect(config.rateLimit.refillPerSec).toBeGreaterThan(0);
    expect(config.requestTimeoutMs).toBeGreaterThan(0);
  });

  it('reads overrides from the environment', () => {
    const config = resolveConfig({
      BACKLINK_RATE_CAPACITY: '20',
      BACKLINK_RATE_REFILL_PER_SEC: '4',
      BACKLINK_USER_AGENT: 'custom-agent/1.0',
      BACKLINK_REQUEST_TIMEOUT_MS: '5000',
    });
    expect(config.rateLimit).toEqual({ capacity: 20, refillPerSec: 4 });
    expect(config.userAgent).toBe('custom-agent/1.0');
    expect(config.requestTimeoutMs).toBe(5000);
  });

  it('falls back to defaults for invalid numeric env values', () => {
    const config = resolveConfig({
      BACKLINK_RATE_CAPACITY: 'not-a-number',
      BACKLINK_REQUEST_TIMEOUT_MS: '-5',
    });
    expect(config.rateLimit.capacity).toBeGreaterThan(0);
    expect(config.requestTimeoutMs).toBeGreaterThan(0);
  });

  it('resolves a polite in-memory scrape limiter (no Upstash creds) by default', () => {
    const config = resolveConfig({});
    expect(config.scrapeRateLimit.limit).toBeGreaterThan(0);
    expect(config.scrapeRateLimit.windowSeconds).toBeGreaterThan(0);
    // Without both Upstash creds, the distributed path is not configured.
    expect(config.scrapeRateLimit.redisUrl).toBeUndefined();
    expect(config.scrapeRateLimit.redisToken).toBeUndefined();
  });

  it('enables the distributed scrape limiter only when BOTH Upstash creds are present', () => {
    const onlyUrl = resolveConfig({ UPSTASH_REDIS_REST_URL: 'https://r.upstash.io' });
    expect(onlyUrl.scrapeRateLimit.redisUrl).toBeUndefined();

    const both = resolveConfig({
      UPSTASH_REDIS_REST_URL: 'https://r.upstash.io',
      UPSTASH_REDIS_REST_TOKEN: 'tok',
      BACKLINK_SCRAPE_LIMIT: '15',
      BACKLINK_SCRAPE_WINDOW_SECONDS: '30',
    });
    expect(both.scrapeRateLimit).toEqual({
      limit: 15,
      windowSeconds: 30,
      redisUrl: 'https://r.upstash.io',
      redisToken: 'tok',
    });
  });

  it('reads the CommonCrawl index override and defaults otherwise', () => {
    expect(resolveConfig({}).commonCrawlIndex).toMatch(/^CC-MAIN-/);
    expect(resolveConfig({ BACKLINK_CC_INDEX: 'CC-MAIN-2025-05' }).commonCrawlIndex).toBe(
      'CC-MAIN-2025-05',
    );
  });
});
