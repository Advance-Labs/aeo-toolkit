/**
 * Regression for the DNS-rebinding report (Vishal Suwalka, 2026-11-27): the guard's lookup says
 * "public", the connection's lookup says "loopback". Before the fix, safeFetch returned the
 * internal response. Real socket, real local server, no network.
 */
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createLiveSafeFetchDeps, safeFetch } from './index.js';

let server: Server;
let port: number;

beforeAll(async () => {
  server = createServer((_req, res) => res.end('SECRET_INTERNAL_RESPONSE'));
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  port = (server.address() as AddressInfo).port;
});
afterAll(() => new Promise<void>((r) => server.close(() => r())));

describe('createLiveSafeFetchDeps pins the connection to a validated address', () => {
  it('blocks when the connect-time lookup rebinds to loopback after a public pre-flight answer', async () => {
    const live = createLiveSafeFetchDeps();
    // Lookup #1 (guard): public. Lookup #2 (connect): `localhost` really resolves to loopback.
    const deps = { ...live, resolve: async () => ['8.8.8.8'] };
    const r = await safeFetch(`http://localhost:${port}/`, {}, deps);
    expect(r).toMatchObject({ ok: false, blockedReason: 'private-address', body: '' });
  });

  it('still blocks a host whose pre-flight answer is private', async () => {
    const r = await safeFetch(`http://localhost:${port}/`, {}, createLiveSafeFetchDeps());
    expect(r.blockedReason).toBe('private-address');
  });
});
