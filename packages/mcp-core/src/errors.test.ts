import { describe, expect, it } from 'vitest';
import { McpToolError, errorMessage, toToolError } from './errors.js';

describe('toToolError', () => {
  it('returns the structured error shape from an Error instance', () => {
    const result = toToolError(new Error('boom'));
    expect(result).toEqual({
      isError: true,
      content: [{ type: 'text', text: 'boom' }],
    });
  });

  it('handles a McpToolError, surfacing its message', () => {
    const result = toToolError(new McpToolError('rate limited', 'RATE_LIMIT'));
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toBe('rate limited');
  });

  it('coerces a thrown string', () => {
    const result = toToolError('plain failure');
    expect(result.content[0]?.text).toBe('plain failure');
  });

  it('coerces an object with a message property', () => {
    const result = toToolError({ message: 'object failure', extra: 1 });
    expect(result.content[0]?.text).toBe('object failure');
  });

  it('falls back to JSON for an arbitrary object', () => {
    const result = toToolError({ code: 42 });
    expect(result.content[0]?.text).toBe('{"code":42}');
  });

  it('never throws on a value JSON cannot serialise (circular)', () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    const result = toToolError(circular);
    expect(result.isError).toBe(true);
    expect(typeof result.content[0]?.text).toBe('string');
  });
});

describe('errorMessage', () => {
  it('extracts messages across value kinds', () => {
    expect(errorMessage(new Error('e'))).toBe('e');
    expect(errorMessage('s')).toBe('s');
    expect(errorMessage(123)).toBe('123');
  });
});

describe('McpToolError', () => {
  it('is an Error subclass carrying an optional code', () => {
    const err = new McpToolError('nope', 'BAD');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(McpToolError);
    expect(err.name).toBe('McpToolError');
    expect(err.code).toBe('BAD');
  });
});
