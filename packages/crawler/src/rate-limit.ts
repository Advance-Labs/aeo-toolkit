/**
 * Per-host rate limiter. Serializes the *spacing* between requests to a given host so we never
 * burst a single origin faster than `minIntervalMs`. Concurrency across hosts is unaffected
 * (that is governed separately by p-limit in the crawl loop).
 *
 * Implementation: each host owns a serial promise chain. An `acquire` call links onto the chain,
 * waits for the previous link, then — using the injected clock — sleeps only as long as needed to
 * keep the configured spacing from the last grant before resolving. The clock + delay are
 * injectable so tests run instantly and deterministically without real timers.
 */
export class PerHostRateLimiter {
  /** Tail of the serial chain per host; the next `acquire` awaits it before proceeding. */
  private readonly chains = new Map<string, Promise<void>>();
  /** Timestamp (from `now()`) of the most recent grant per host. */
  private readonly lastGrant = new Map<string, number>();

  constructor(
    private readonly minIntervalMs: number,
    /** Injectable clock so spacing math is testable; defaults to wall-clock ms. */
    private readonly now: () => number = () => Date.now(),
    /** Injectable sleep so tests resolve instantly; defaults to real `setTimeout`. */
    private readonly delay: (ms: number) => Promise<void> = defaultDelay,
  ) {}

  /**
   * Resolves when the caller may issue a request to `host`. Successive calls for the same host
   * are spaced at least `minIntervalMs` apart. A non-positive interval makes this a no-op.
   */
  async acquire(host: string): Promise<void> {
    if (this.minIntervalMs <= 0) return;

    const previous = this.chains.get(host) ?? Promise.resolve();
    // Chain this acquire after the previous one for the same host.
    const mine = previous.then(() => this.waitForSlot(host));
    // Store a swallowed tail so a rejection upstream never unhandled-rejects the chain.
    const tail: Promise<void> = mine.then(
      () => undefined,
      () => undefined,
    );
    this.chains.set(host, tail);
    await mine;
  }

  /** Sleep just long enough to honor the spacing since this host's last grant, then record now. */
  private async waitForSlot(host: string): Promise<void> {
    const last = this.lastGrant.get(host);
    if (last !== undefined) {
      const elapsed = this.now() - last;
      const remaining = this.minIntervalMs - elapsed;
      if (remaining > 0) await this.delay(remaining);
    } else {
      // First request to this host still respects spacing from "now" for subsequent calls.
      await this.delay(this.minIntervalMs);
    }
    this.lastGrant.set(host, this.now());
  }
}

function defaultDelay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
