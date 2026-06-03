import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Minimal stand-in for `NextResponse` so the route can be unit-tested without booting Next's
 * server runtime. `json()` records the body + status on a plain object we can assert against.
 */
interface FakeResponse {
  status: number;
  body: unknown;
  json(): Promise<unknown>;
}

vi.mock('next/server', () => ({
  NextResponse: {
    json(body: unknown, init?: { status?: number }): FakeResponse {
      const status = init?.status ?? 200;
      return { status, body, json: () => Promise.resolve(body) };
    },
  },
}));

// Mock the pipeline so the auth gate is tested in isolation — no network, no LLM, no Google.
const runBloggingPipeline = vi.fn();
vi.mock('@aeo/blogging', () => ({
  runBloggingPipeline: (...args: unknown[]): unknown => runBloggingPipeline(...args),
}));

// Imported after the mocks are registered.
const { GET } = await import('./route.js');

const ORIGINAL_SECRET = process.env['CRON_SECRET'];

function request(headers: Record<string, string> = {}): Request {
  return new Request('https://console.test/api/cron/blogging', { headers });
}

describe('GET /api/cron/blogging (auth gate)', () => {
  beforeEach(() => {
    runBloggingPipeline.mockReset();
    process.env['CRON_SECRET'] = 'top-secret';
  });

  afterEach(() => {
    if (ORIGINAL_SECRET === undefined) delete process.env['CRON_SECRET'];
    else process.env['CRON_SECRET'] = ORIGINAL_SECRET;
  });

  it('returns 401 when the Authorization header is missing', async () => {
    const res = (await GET(request())) as unknown as FakeResponse;
    expect(res.status).toBe(401);
    expect(runBloggingPipeline).not.toHaveBeenCalled();
  });

  it('returns 401 when the bearer token does not match CRON_SECRET', async () => {
    const res = (await GET(request({ authorization: 'Bearer wrong' }))) as unknown as FakeResponse;
    expect(res.status).toBe(401);
    expect(runBloggingPipeline).not.toHaveBeenCalled();
  });

  it('returns 401 when CRON_SECRET is unset (fail closed)', async () => {
    delete process.env['CRON_SECRET'];
    const res = (await GET(
      request({ authorization: 'Bearer top-secret' }),
    )) as unknown as FakeResponse;
    expect(res.status).toBe(401);
    expect(runBloggingPipeline).not.toHaveBeenCalled();
  });

  it('runs the pipeline and returns its summary on a valid bearer token', async () => {
    const summary = { published: 2, publishedSlugs: ['a', 'b'] };
    runBloggingPipeline.mockResolvedValue(summary);

    const res = (await GET(
      request({ authorization: 'Bearer top-secret' }),
    )) as unknown as FakeResponse;

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, summary });
    expect(runBloggingPipeline).toHaveBeenCalledTimes(1);
  });

  it('returns 500 with only the error message when the pipeline throws', async () => {
    runBloggingPipeline.mockRejectedValue(new Error('boom'));

    const res = (await GET(
      request({ authorization: 'Bearer top-secret' }),
    )) as unknown as FakeResponse;

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ ok: false, error: 'boom' });
  });
});
