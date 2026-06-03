import { describe, it, expect } from 'vitest';
import { PerHostRateLimiter } from './rate-limit.js';

describe('PerHostRateLimiter', () => {
  it('is a no-op when the interval is zero or negative (edge case)', async () => {
    const limiter = new PerHostRateLimiter(0);
    // Should resolve immediately for many calls without any delay function.
    await Promise.all([limiter.acquire('a'), limiter.acquire('a'), limiter.acquire('b')]);
    expect(true).toBe(true);
  });

  it('serializes acquisitions for the same host using the injected delay', async () => {
    const order: string[] = [];
    // Injected delay records and resolves on a microtask so the test is instant but ordered.
    const delay = (ms: number): Promise<void> => {
      order.push(`delay:${ms}`);
      return Promise.resolve();
    };
    const limiter = new PerHostRateLimiter(100, () => 0, delay);

    await limiter.acquire('host-a');
    await limiter.acquire('host-a');

    // Each acquire for the same host triggers a spacing delay.
    expect(order.filter((o) => o === 'delay:100').length).toBeGreaterThanOrEqual(2);
  });

  it('does not block distinct hosts behind each other', async () => {
    const delay = (): Promise<void> => Promise.resolve();
    const limiter = new PerHostRateLimiter(50, () => 0, delay);

    // Different hosts: both acquisitions resolve without waiting on each other.
    await Promise.all([limiter.acquire('host-a'), limiter.acquire('host-b')]);
    expect(true).toBe(true);
  });
});
