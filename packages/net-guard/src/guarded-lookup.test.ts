import { describe, expect, it, vi } from 'vitest';

vi.mock('node:dns', () => ({
  lookup: (host: string, _opts: unknown, cb: (e: Error | null, r: { address: string; family: number }[]) => void) => {
    const table: Record<string, { address: string; family: number }[]> = {
      'pub.test': [{ address: '93.184.216.34', family: 4 }],
      'mixed.test': [{ address: '93.184.216.34', family: 4 }, { address: '10.0.0.5', family: 4 }],
      'empty.test': [],
    };
    const records = table[host];
    if (!records) cb(Object.assign(new Error('ENOTFOUND'), { code: 'ENOTFOUND' }), []);
    else cb(null, records);
  },
}));

const { guardedLookup, GUARD_BLOCKED } = await import('./index.js');

function call(host: string, all: boolean) {
  return new Promise<{ err: NodeJS.ErrnoException | null; address: unknown; family?: number }>((resolve) =>
    guardedLookup(host, { all }, (err, address, family) => resolve({ err, address, family })),
  );
}

describe('guardedLookup', () => {
  it('passes a public answer through in both callback shapes', async () => {
    expect(await call('pub.test', false)).toEqual({ err: null, address: '93.184.216.34', family: 4 });
    expect((await call('pub.test', true)).address).toEqual([{ address: '93.184.216.34', family: 4 }]);
  });

  it('refuses when any answer is private, or there are none', async () => {
    expect((await call('mixed.test', true)).err?.code).toBe(GUARD_BLOCKED);
    expect((await call('empty.test', false)).err?.code).toBe(GUARD_BLOCKED);
  });

  it('forwards DNS errors unchanged', async () => {
    expect((await call('nope.test', false)).err?.code).toBe('ENOTFOUND');
  });
});
