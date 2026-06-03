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
});
