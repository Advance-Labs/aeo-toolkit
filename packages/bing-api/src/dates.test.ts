import { describe, expect, it } from 'vitest';
import { parseWcfDate, toWcfDate, WcfDateError } from './dates.js';

describe('parseWcfDate', () => {
  it('reads the epoch milliseconds as UTC', () => {
    // 1399100400000 ms == 2014-05-03T07:00:00.000Z
    expect(parseWcfDate('/Date(1399100400000)/').toISOString()).toBe(
      '2014-05-03T07:00:00.000Z',
    );
  });

  it('IGNORES the trailing offset — it is display metadata, not an adjustment', () => {
    const bare = parseWcfDate('/Date(1399100400000)/');
    const negative = parseWcfDate('/Date(1399100400000-0700)/');
    const positive = parseWcfDate('/Date(1399100400000+0530)/');
    expect(negative.getTime()).toBe(bare.getTime());
    expect(positive.getTime()).toBe(bare.getTime());
  });

  it('handles a pre-epoch negative millisecond value', () => {
    expect(parseWcfDate('/Date(-86400000)/').toISOString()).toBe('1969-12-31T00:00:00.000Z');
  });

  it('parses across a DST boundary without shifting', () => {
    // 2014-11-02T09:00:00Z — US DST ended that morning.
    expect(parseWcfDate('/Date(1414918800000-0500)/').toISOString()).toBe(
      '2014-11-02T09:00:00.000Z',
    );
  });

  it.each([
    ['', 'empty'],
    ['2014-05-03', 'ISO 8601'],
    ['/Date()/', 'no payload'],
    ['/Date(abc)/', 'non-numeric'],
    ['/Date(1399100400000-07)/', 'malformed offset'],
    ['1399100400000', 'bare number'],
  ])('throws WcfDateError on %s input (%s)', (raw) => {
    expect(() => parseWcfDate(raw)).toThrow(WcfDateError);
  });

  it('never yields an Invalid Date', () => {
    expect(() => parseWcfDate('/Date(NaN)/')).toThrow(WcfDateError);
  });
});

describe('toWcfDate', () => {
  it('round-trips through parseWcfDate', () => {
    const original = new Date('2014-05-03T07:00:00.000Z');
    expect(parseWcfDate(toWcfDate(original)).getTime()).toBe(original.getTime());
  });

  it('throws on an Invalid Date', () => {
    expect(() => toWcfDate(new Date('nonsense'))).toThrow(WcfDateError);
  });
});
