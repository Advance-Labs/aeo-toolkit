import { describe, expect, it, vi } from 'vitest';
import type { LlmCompletionRequest } from '@advance-labs/types';
import type { Fetcher, FetchResponse } from './fetcher.js';
import { complete } from './complete.js';
import { LlmHttpError, LlmRequestError, LlmResponseError } from './errors.js';

/** Records the single fetch call and returns a canned body, mimicking a fetch Response. */
interface Captured {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string;
}

function mockFetcher(
  status: number,
  responseBody: string,
): { fetcher: Fetcher; calls: Captured[] } {
  const calls: Captured[] = [];
  const fetcher: Fetcher = vi.fn(async (url, init) => {
    calls.push({ url, method: init.method, headers: init.headers, body: init.body });
    const res: FetchResponse = {
      ok: status >= 200 && status < 300,
      status,
      statusText: status === 200 ? 'OK' : 'Error',
      text: async () => responseBody,
    };
    return res;
  });
  return { fetcher, calls };
}

const baseReq = (over: Partial<LlmCompletionRequest> = {}): LlmCompletionRequest => ({
  provider: 'openai',
  model: 'gpt-4o-mini',
  apiKey: 'sk-test-123',
  messages: [
    { role: 'system', content: 'be helpful' },
    { role: 'user', content: 'ping' },
  ],
  ...over,
});

describe('complete — anthropic', () => {
  it('posts to the messages endpoint with x-api-key + version and parses content[].text', async () => {
    const body = JSON.stringify({
      model: 'claude-sonnet-4',
      content: [
        { type: 'text', text: 'Hello ' },
        { type: 'thinking', text: 'IGNORED' },
        { type: 'text', text: 'world' },
      ],
      usage: { input_tokens: 11, output_tokens: 4 },
    });
    const { fetcher, calls } = mockFetcher(200, body);

    const res = await complete(
      baseReq({
        provider: 'anthropic',
        model: 'claude-sonnet-4',
        maxTokens: 256,
        temperature: 0.2,
      }),
      { fetcher },
    );

    expect(res.text).toBe('Hello world');
    expect(res.model).toBe('claude-sonnet-4');
    expect(res.usage).toEqual({ promptTokens: 11, completionTokens: 4 });

    const call = calls[0];
    expect(call).toBeDefined();
    expect(call?.url).toBe('https://api.anthropic.com/v1/messages');
    expect(call?.headers['x-api-key']).toBe('sk-test-123');
    expect(call?.headers['anthropic-version']).toBe('2023-06-01');
    expect(call?.headers['authorization']).toBeUndefined();

    const sent = JSON.parse(call?.body ?? '{}') as Record<string, unknown>;
    expect(sent['system']).toBe('be helpful');
    expect(sent['max_tokens']).toBe(256);
    expect(sent['temperature']).toBe(0.2);
    expect(sent['messages']).toEqual([{ role: 'user', content: 'ping' }]);
  });

  it('defaults max_tokens when the request omits it (edge case)', async () => {
    const { fetcher, calls } = mockFetcher(
      200,
      JSON.stringify({ content: [{ type: 'text', text: 'ok' }] }),
    );
    const res = await complete(baseReq({ provider: 'anthropic', model: 'claude-x' }), { fetcher });
    expect(res.text).toBe('ok');
    expect(res.model).toBe('claude-x'); // falls back to request model when absent in body
    const sent = JSON.parse(calls[0]?.body ?? '{}') as Record<string, unknown>;
    expect(sent['max_tokens']).toBe(1024);
  });
});

describe('complete — openai & groq', () => {
  it('openai: posts Bearer auth to api.openai.com and maps choices[0].message.content', async () => {
    const body = JSON.stringify({
      model: 'gpt-4o-mini',
      choices: [{ message: { role: 'assistant', content: 'pong' } }],
      usage: { prompt_tokens: 7, completion_tokens: 2 },
    });
    const { fetcher, calls } = mockFetcher(200, body);

    const res = await complete(baseReq({ provider: 'openai' }), { fetcher });

    expect(res.text).toBe('pong');
    expect(res.usage).toEqual({ promptTokens: 7, completionTokens: 2 });
    expect(res.citations).toBeUndefined();

    const call = calls[0];
    expect(call?.url).toBe('https://api.openai.com/v1/chat/completions');
    expect(call?.headers['authorization']).toBe('Bearer sk-test-123');

    const sent = JSON.parse(call?.body ?? '{}') as { messages: unknown };
    expect(sent.messages).toEqual([
      { role: 'system', content: 'be helpful' },
      { role: 'user', content: 'ping' },
    ]);
  });

  it('groq: targets the groq openai-compatible base URL', async () => {
    const { fetcher, calls } = mockFetcher(
      200,
      JSON.stringify({ choices: [{ message: { content: 'g' } }] }),
    );
    await complete(baseReq({ provider: 'groq', model: 'llama-3.1-8b' }), { fetcher });
    expect(calls[0]?.url).toBe('https://api.groq.com/openai/v1/chat/completions');
  });
});

describe('complete — perplexity', () => {
  it('targets api.perplexity.ai and extracts citations', async () => {
    const body = JSON.stringify({
      model: 'sonar',
      choices: [{ message: { content: 'answer' } }],
      citations: ['https://src1.com', { url: 'https://src2.com', title: 'Src 2' }],
    });
    const { fetcher, calls } = mockFetcher(200, body);

    const res = await complete(baseReq({ provider: 'perplexity', model: 'sonar' }), { fetcher });

    expect(calls[0]?.url).toBe('https://api.perplexity.ai/chat/completions');
    expect(res.text).toBe('answer');
    expect(res.citations).toEqual([
      { url: 'https://src1.com' },
      { url: 'https://src2.com', title: 'Src 2' },
    ]);
  });

  it('omits citations when none are returned (edge case)', async () => {
    const { fetcher } = mockFetcher(
      200,
      JSON.stringify({ choices: [{ message: { content: 'a' } }] }),
    );
    const res = await complete(baseReq({ provider: 'perplexity', model: 'sonar' }), { fetcher });
    expect(res.citations).toBeUndefined();
  });
});

describe('complete — gateway', () => {
  it('passes a provider/model string through verbatim with Bearer auth', async () => {
    const { fetcher, calls } = mockFetcher(
      200,
      JSON.stringify({
        model: 'anthropic/claude-sonnet-4',
        choices: [{ message: { content: 'gw' } }],
      }),
    );

    const res = await complete(
      baseReq({ provider: 'gateway', model: 'anthropic/claude-sonnet-4' }),
      { fetcher },
    );

    expect(res.text).toBe('gw');
    expect(calls[0]?.url).toBe('https://ai-gateway.vercel.sh/v1/chat/completions');
    expect(calls[0]?.headers['authorization']).toBe('Bearer sk-test-123');
    const sent = JSON.parse(calls[0]?.body ?? '{}') as Record<string, unknown>;
    expect(sent['model']).toBe('anthropic/claude-sonnet-4');
  });
});

describe('complete — validation & errors', () => {
  it('throws LlmRequestError when apiKey is missing', () => {
    expect(() => complete(baseReq({ apiKey: '' }))).toThrow(LlmRequestError);
  });

  it('throws LlmRequestError when model is empty', () => {
    expect(() => complete(baseReq({ model: '' }))).toThrow(LlmRequestError);
  });

  it('throws LlmHttpError on a non-2xx upstream status', async () => {
    const { fetcher } = mockFetcher(401, '{"error":"bad key"}');
    await expect(complete(baseReq({ provider: 'openai' }), { fetcher })).rejects.toBeInstanceOf(
      LlmHttpError,
    );
  });

  it('throws LlmResponseError when the body is not valid JSON', async () => {
    const { fetcher } = mockFetcher(200, 'not-json');
    await expect(complete(baseReq({ provider: 'openai' }), { fetcher })).rejects.toBeInstanceOf(
      LlmResponseError,
    );
  });

  it('throws LlmResponseError when choices are missing', async () => {
    const { fetcher } = mockFetcher(200, JSON.stringify({ model: 'x' }));
    await expect(complete(baseReq({ provider: 'openai' }), { fetcher })).rejects.toBeInstanceOf(
      LlmResponseError,
    );
  });

  it('never leaks the apiKey into the error body', async () => {
    const { fetcher } = mockFetcher(500, 'upstream exploded');
    try {
      await complete(baseReq({ provider: 'anthropic', model: 'claude-x' }), { fetcher });
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(LlmHttpError);
      const httpErr = err as LlmHttpError;
      expect(httpErr.body).not.toContain('sk-test-123');
      expect(httpErr.message).not.toContain('sk-test-123');
    }
  });
});
