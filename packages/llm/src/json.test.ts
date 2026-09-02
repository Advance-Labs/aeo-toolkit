import { describe, expect, it } from 'vitest';
import { LlmResponseError } from './errors.js';
import { asRecord, parseJson, readNumber, readString } from './json.js';

describe('parseJson', () => {
  it('parses clean JSON unchanged', () => {
    expect(parseJson('openai', '{"ok":true,"items":[1,2]}')).toEqual({
      ok: true,
      items: [1, 2],
    });
  });

  it.each([
    ['fenced JSON', '```json\n{"ok":true}\n```'],
    ['leading prose', 'Here is the result: {"ok": true}'],
    ['truncated JSON', '{"ok":'],
  ])('wraps %s parse failures in LlmResponseError', (_name, body) => {
    expect(() => parseJson('anthropic', body)).toThrow(LlmResponseError);

    try {
      parseJson('anthropic', body);
      expect.unreachable('parseJson should throw');
    } catch (err) {
      expect(err).toBeInstanceOf(LlmResponseError);
      const responseErr = err as LlmResponseError;
      expect(responseErr.provider).toBe('anthropic');
      expect(responseErr.message).toContain('response body was not valid JSON');
    }
  });
});

describe('asRecord', () => {
  it('narrows plain object-shaped values', () => {
    const record = asRecord({ id: 'abc', count: 2 });

    expect(record).toEqual({ id: 'abc', count: 2 });
  });

  it.each([null, undefined, 'text', 1, true, ['not', 'a', 'record']])('rejects %j', (value) => {
    expect(asRecord(value)).toBeUndefined();
  });
});

describe('readString', () => {
  it('reads string properties only', () => {
    const record: Record<string, unknown> = { text: 'hello', count: 1, missing: undefined };

    expect(readString(record, 'text')).toBe('hello');
    expect(readString(record, 'count')).toBeUndefined();
    expect(readString(record, 'missing')).toBeUndefined();
    expect(readString(record, 'unknown')).toBeUndefined();
  });
});

describe('readNumber', () => {
  it('reads finite number properties only', () => {
    const record: Record<string, unknown> = {
      count: 3,
      nan: Number.NaN,
      infinity: Number.POSITIVE_INFINITY,
      text: '3',
    };

    expect(readNumber(record, 'count')).toBe(3);
    expect(readNumber(record, 'nan')).toBeUndefined();
    expect(readNumber(record, 'infinity')).toBeUndefined();
    expect(readNumber(record, 'text')).toBeUndefined();
    expect(readNumber(record, 'unknown')).toBeUndefined();
  });
});
