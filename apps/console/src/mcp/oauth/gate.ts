/**
 * Who is calling the search MCP server, and with which credentials.
 *
 * Three ways in, checked in this order:
 *  1. `Authorization: Bearer aeo_at_…`: a token this server's OAuth flow issued. It names a stored
 *     Google connection (`sub`), and the tools resolve and refresh THAT user's Google token.
 *  2. `Authorization: Bearer <anything else>` and/or `x-bing-api-key`: BYOK, unchanged. A raw Google
 *     access token and a Bing key, used for this request only.
 *  3. Nothing at all. With the authorization server configured, answer 401 with a `WWW-Authenticate`
 *     challenge naming this resource's RFC 9728 metadata. That 401 is the ONLY thing that makes an MCP
 *     client start its login; answering `initialize` anonymously (as this server used to) is why
 *     Claude Code never tried. Unconfigured (local dev without a secret), fall through as before.
 *
 * An `aeo_at_` token that fails to unseal, has expired, or was minted for another origin is also a
 * 401 (`invalid_token`), never a silent downgrade to anonymous: the client must learn to refresh.
 *
 * The OAuth caller's `userId` is the stored connection's id and never `default`, so the shared-slot
 * fallback in `TokenResolver` can't hand one caller another caller's Google token.
 */
import { DEFAULT_USER_ID } from '../search/auth/google.js';
import { bearerToken, bingApiKeyHeader } from '../search/http-util.js';
import {
  isProtectedResource,
  oauthSecret,
  requestOrigin,
  resourceMetadataUrl,
  SEARCH_SCOPE,
  type ProtectedResourcePath,
} from './config.js';
import { readGrant } from './grants.js';
import { ACCESS_TOKEN_PREFIX } from './seal.js';

export interface SearchCaller {
  userId: string;
  requestToken: string | null;
  requestBingKey: string | null;
}

export type GateResult = { ok: true; caller: SearchCaller } | { ok: false; response: Response };

function challenge(
  origin: string,
  path: ProtectedResourcePath,
  error: { code: 'invalid_token'; description: string } | null,
): Response {
  const params = [
    ...(error ? [`error="${error.code}"`, `error_description="${error.description}"`] : []),
    `resource_metadata="${resourceMetadataUrl(origin, path)}"`,
    `scope="${SEARCH_SCOPE}"`,
  ];
  const body = error ?? {
    code: 'unauthorized',
    description:
      'Sign in to use this server. MCP clients that support OAuth will open a browser to connect ' +
      'Google. Otherwise send a Google access token as `Authorization: Bearer <token>` and/or a ' +
      'Bing Webmaster key as `x-bing-api-key`.',
  };
  return Response.json(
    { error: body.code, error_description: body.description },
    { status: 401, headers: { 'WWW-Authenticate': `Bearer ${params.join(', ')}` } },
  );
}

export function authenticateSearchRequest(
  request: Request,
  path: ProtectedResourcePath,
  env: Record<string, string | undefined> = process.env,
  now?: number,
): GateResult {
  const secret = oauthSecret(env);
  const origin = requestOrigin(request);
  const bearer = bearerToken(request.headers.get('authorization'));
  const bingKey = bingApiKeyHeader(request.headers);

  if (bearer !== null && bearer.startsWith(ACCESS_TOKEN_PREFIX)) {
    const grant = secret === null ? null : readGrant('access', bearer, secret, now);
    if (grant === null || (grant.resource !== undefined && !isProtectedResource(origin, grant.resource))) {
      return {
        ok: false,
        response: challenge(origin, path, {
          code: 'invalid_token',
          description: 'The access token is invalid or has expired',
        }),
      };
    }
    return { ok: true, caller: { userId: grant.sub, requestToken: null, requestBingKey: bingKey } };
  }

  if (bearer === null && bingKey === null && secret !== null) {
    return { ok: false, response: challenge(origin, path, null) };
  }

  return {
    ok: true,
    caller: { userId: DEFAULT_USER_ID, requestToken: bearer, requestBingKey: bingKey },
  };
}
