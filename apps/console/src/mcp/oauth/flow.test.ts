/**
 * The whole MCP login, route by route, the way Claude Code drives it: 401 challenge, discovery,
 * registration, authorize, the Connect Google round-trip (simulated by storing tokens under the
 * session id, which is all the real callback leaves behind), code exchange, a tool call, refresh.
 */
import { createHash } from 'node:crypto';

import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { __resetTokenStoreForTests, getTokenStore } from '@/lib/token-store';

const ORIGIN = 'https://aeo.test';
const RESOURCE = `${ORIGIN}/api/mcp/search/mcp`;
const REDIRECT = 'http://localhost:43111/callback';
const VERIFIER = 'a'.repeat(43) + 'b-._~';
const CHALLENGE = createHash('sha256').update(VERIFIER).digest('base64url');
const SESSION = 'session-user-1';

const form = (fields: Record<string, string>): Request =>
  new Request(`${ORIGIN}/api/mcp/oauth/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(fields).toString(),
  });

/** Value of `name` in a response's Set-Cookie headers. */
function cookieValue(response: Response, name: string): string | undefined {
  const line = response.headers.getSetCookie().find((c) => c.startsWith(`${name}=`));
  return line?.slice(name.length + 1).split(';')[0];
}

async function register(): Promise<string> {
  const { POST } = await import('@/app/api/mcp/oauth/register/route');
  const response = await POST(
    new Request(`${ORIGIN}/api/mcp/oauth/register`, {
      method: 'POST',
      body: JSON.stringify({ redirect_uris: [REDIRECT], client_name: 'Claude Code (aeo-search)' }),
    }),
  );
  expect(response.status).toBe(201);
  return ((await response.json()) as { client_id: string }).client_id;
}

/** authorize → (Google) → complete; returns the code delivered to the client's redirect. */
async function loginForCode(clientId: string): Promise<URL> {
  const { GET: authorize } = await import('@/app/api/mcp/oauth/authorize/route');
  const { GET: complete } = await import('@/app/api/mcp/oauth/complete/route');

  const url = new URL(`${ORIGIN}/api/mcp/oauth/authorize`);
  for (const [k, v] of Object.entries({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: 'http://localhost:50000/callback', // a different free port than registered
    code_challenge: CHALLENGE,
    code_challenge_method: 'S256',
    state: 'xyz',
    resource: RESOURCE,
  })) {
    url.searchParams.set(k, v);
  }
  const started = authorize(new NextRequest(url));
  expect(started.status).toBe(307);
  const google = new URL(started.headers.get('location') ?? '');
  expect(google.pathname).toBe('/api/auth/google');
  expect(google.searchParams.get('return_to')).toBe(`${ORIGIN}/api/mcp/oauth/complete`);
  const pending = cookieValue(started, 'aeo_mcp_authz');
  expect(pending).toBeTruthy();

  // What the real Google callback leaves behind: tokens stored under the session id.
  await getTokenStore().set(SESSION, {
    accessToken: 'ya29.x',
    refreshToken: 'r',
    expiresAt: Date.now() + 3_600_000,
    scope: 'https://www.googleapis.com/auth/webmasters.readonly',
  });

  const done = await complete(
    new NextRequest(`${ORIGIN}/api/mcp/oauth/complete?connected=1`, {
      headers: { cookie: `aeo_mcp_authz=${pending}; aeo_session=${SESSION}` },
    }),
  );
  expect(done.status).toBe(307);
  expect(cookieValue(done, 'aeo_mcp_authz')).toBe('');
  return new URL(done.headers.get('location') ?? '');
}

beforeEach(() => {
  process.env.OAUTH_STATE_SECRET = 'flow-test-secret';
  delete process.env.SUPABASE_URL;
  __resetTokenStoreForTests();
});

afterEach(() => {
  delete process.env.OAUTH_STATE_SECRET;
});

describe('discovery', () => {
  it('serves path-scoped documents and keeps the root ones 404', async () => {
    const prm = await import('@/app/.well-known/oauth-protected-resource/api/mcp/search/mcp/route');
    const asm = await import('@/app/.well-known/oauth-authorization-server/api/mcp/oauth/route');
    const rootPrm = await import('@/app/.well-known/oauth-protected-resource/route');
    const rootAsm = await import('@/app/.well-known/oauth-authorization-server/route');

    const resource = (await prm.GET(new Request(`${ORIGIN}/x`)).json()) as Record<string, unknown>;
    expect(resource).toMatchObject({
      resource: RESOURCE,
      authorization_servers: [`${ORIGIN}/api/mcp/oauth`],
    });
    const server = (await asm.GET(new Request(`${ORIGIN}/x`)).json()) as Record<string, unknown>;
    expect(server).toMatchObject({
      issuer: `${ORIGIN}/api/mcp/oauth`,
      registration_endpoint: `${ORIGIN}/api/mcp/oauth/register`,
      code_challenge_methods_supported: ['S256'],
    });

    expect(rootPrm.GET().status).toBe(404);
    expect(rootAsm.GET().status).toBe(404);
  });

  it('serves nothing when the secret is unset', async () => {
    delete process.env.OAUTH_STATE_SECRET;
    const prm = await import('@/app/.well-known/oauth-protected-resource/api/mcp/search/mcp/route');
    expect(prm.GET(new Request(`${ORIGIN}/x`)).status).toBe(404);
  });
});

describe('the MCP gate', () => {
  it('challenges an anonymous caller with the resource metadata URL', async () => {
    const { authenticateSearchRequest } = await import('./gate.js');
    const result = authenticateSearchRequest(new Request(RESOURCE, { method: 'POST' }), '/api/mcp/search/mcp');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.response.status).toBe(401);
    expect(result.response.headers.get('www-authenticate')).toContain(
      `resource_metadata="${ORIGIN}/.well-known/oauth-protected-resource/api/mcp/search/mcp"`,
    );
  });

  it('still lets BYOK callers straight through, as the default user', async () => {
    const { authenticateSearchRequest } = await import('./gate.js');
    const google = authenticateSearchRequest(
      new Request(RESOURCE, { headers: { authorization: 'Bearer ya29.raw' } }),
      '/api/mcp/search/mcp',
    );
    expect(google).toEqual({
      ok: true,
      caller: { userId: 'default', requestToken: 'ya29.raw', requestBingKey: null },
    });
    const bing = authenticateSearchRequest(
      new Request(RESOURCE, { headers: { 'x-bing-api-key': 'bk' } }),
      '/api/mcp/search/mcp',
    );
    expect(bing.ok).toBe(true);
  });

  it('keeps the old open behaviour when OAuth is not configured', async () => {
    delete process.env.OAUTH_STATE_SECRET;
    const { authenticateSearchRequest } = await import('./gate.js');
    expect(authenticateSearchRequest(new Request(RESOURCE), '/api/mcp/search/mcp').ok).toBe(true);
  });

  it('rejects a forged aeo_at_ token with invalid_token rather than treating it as BYOK', async () => {
    const { authenticateSearchRequest } = await import('./gate.js');
    const result = authenticateSearchRequest(
      new Request(RESOURCE, { headers: { authorization: 'Bearer aeo_at_forged' } }),
      '/api/mcp/search/mcp',
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.response.headers.get('www-authenticate')).toContain('error="invalid_token"');
  });
});

describe('the login', () => {
  it('registers, authorizes through Google, exchanges the code, and calls as that user', async () => {
    const { POST: token } = await import('@/app/api/mcp/oauth/token/route');
    const { authenticateSearchRequest } = await import('./gate.js');

    const clientId = await register();
    const back = await loginForCode(clientId);
    expect(back.origin + back.pathname).toBe('http://localhost:50000/callback');
    expect(back.searchParams.get('state')).toBe('xyz');
    expect(back.searchParams.get('iss')).toBe(`${ORIGIN}/api/mcp/oauth`);
    const code = back.searchParams.get('code') ?? '';

    const exchanged = await token(
      form({
        grant_type: 'authorization_code',
        code,
        client_id: clientId,
        redirect_uri: 'http://localhost:50000/callback',
        code_verifier: VERIFIER,
        resource: RESOURCE,
      }),
    );
    expect(exchanged.status).toBe(200);
    expect(exchanged.headers.get('cache-control')).toBe('no-store');
    const tokens = (await exchanged.json()) as { access_token: string; refresh_token: string };

    const call = authenticateSearchRequest(
      new Request(RESOURCE, { headers: { authorization: `Bearer ${tokens.access_token}` } }),
      '/api/mcp/search/mcp',
    );
    // The caller resolves to its OWN stored connection, never the shared `default` slot.
    expect(call).toEqual({ ok: true, caller: { userId: SESSION, requestToken: null, requestBingKey: null } });

    const refreshed = await token(
      form({ grant_type: 'refresh_token', refresh_token: tokens.refresh_token, client_id: clientId }),
    );
    expect(refreshed.status).toBe(200);
  });

  it('refuses a code without the right verifier, or from another client', async () => {
    const { POST: token } = await import('@/app/api/mcp/oauth/token/route');
    const clientId = await register();
    const code = (await loginForCode(clientId)).searchParams.get('code') ?? '';

    const wrongVerifier = await token(
      form({ grant_type: 'authorization_code', code, client_id: clientId, code_verifier: 'z'.repeat(43) }),
    );
    expect(wrongVerifier.status).toBe(400);

    const otherClient = await register();
    const stolen = await token(
      form({ grant_type: 'authorization_code', code, client_id: otherClient, code_verifier: VERIFIER }),
    );
    expect(((await stolen.json()) as { error: string }).error).toBe('invalid_grant');
  });

  it('stops refreshing once the Google connection is gone', async () => {
    const { POST: token } = await import('@/app/api/mcp/oauth/token/route');
    const clientId = await register();
    const code = (await loginForCode(clientId)).searchParams.get('code') ?? '';
    const tokens = (await (
      await token(form({ grant_type: 'authorization_code', code, client_id: clientId, code_verifier: VERIFIER }))
    ).json()) as { refresh_token: string };

    await getTokenStore().delete(SESSION);
    const refreshed = await token(
      form({ grant_type: 'refresh_token', refresh_token: tokens.refresh_token, client_id: clientId }),
    );
    expect(refreshed.status).toBe(400);
  });

  it('refuses to redirect to an unregistered URI, and does not redirect at all when it does', async () => {
    const { GET: authorize } = await import('@/app/api/mcp/oauth/authorize/route');
    const clientId = await register();
    const url = new URL(`${ORIGIN}/api/mcp/oauth/authorize`);
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('redirect_uri', 'https://evil.example/callback');
    url.searchParams.set('response_type', 'code');
    const response = authorize(new NextRequest(url));
    expect(response.status).toBe(400);
    expect(response.headers.get('location')).toBeNull();
  });

  it('sends a cancelled Google consent back to the client as access_denied', async () => {
    const { GET: authorize } = await import('@/app/api/mcp/oauth/authorize/route');
    const { GET: complete } = await import('@/app/api/mcp/oauth/complete/route');
    const clientId = await register();
    const url = new URL(`${ORIGIN}/api/mcp/oauth/authorize`);
    for (const [k, v] of Object.entries({
      response_type: 'code', client_id: clientId, redirect_uri: REDIRECT,
      code_challenge: CHALLENGE, code_challenge_method: 'S256', state: 's1',
    })) url.searchParams.set(k, v);
    const pending = cookieValue(authorize(new NextRequest(url)), 'aeo_mcp_authz');

    const done = await complete(
      new NextRequest(`${ORIGIN}/api/mcp/oauth/complete?error=access_denied`, {
        headers: { cookie: `aeo_mcp_authz=${pending}` },
      }),
    );
    const back = new URL(done.headers.get('location') ?? '');
    expect(back.searchParams.get('error')).toBe('access_denied');
    expect(back.searchParams.get('state')).toBe('s1');
    expect(back.searchParams.get('code')).toBeNull();
  });
});
