import { afterEach, describe, expect, it } from 'vitest';
import { googleEnv, MissingEnvError } from './google-env.js';

const KEYS = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REDIRECT_URI'] as const;
const original = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));

afterEach(() => {
  for (const k of KEYS) {
    if (original[k] === undefined) delete process.env[k];
    else process.env[k] = original[k];
  }
});

describe('googleEnv', () => {
  it('trims a trailing newline a CLI pipe left on a value', () => {
    process.env['GOOGLE_CLIENT_ID'] = 'id.apps.googleusercontent.com\n';
    process.env['GOOGLE_CLIENT_SECRET'] = ' secret \n';
    process.env['GOOGLE_REDIRECT_URI'] = 'https://x.test/api/auth/google/callback\n';
    expect(googleEnv()).toEqual({
      clientId: 'id.apps.googleusercontent.com',
      clientSecret: 'secret',
      redirectUri: 'https://x.test/api/auth/google/callback',
    });
  });

  it('treats a whitespace-only value as missing', () => {
    process.env['GOOGLE_CLIENT_ID'] = 'id';
    process.env['GOOGLE_CLIENT_SECRET'] = '\n';
    process.env['GOOGLE_REDIRECT_URI'] = 'https://x.test/cb';
    expect(() => googleEnv()).toThrow(MissingEnvError);
  });
});
