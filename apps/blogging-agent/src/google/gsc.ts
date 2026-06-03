/**
 * Typed seam over `@aeo/google-api`'s GscClient.
 *
 * Agents depend on the `GscQueryFn` type, not the concrete client, so tests inject a mock with
 * no network and no OAuth token. `makeGscQuery` is the production wiring.
 */
import { GscClient } from '@aeo/google-api';
import type { Fetcher } from '@aeo/google-api';
import type { GscQueryRequest, GscReport } from '@aeo/types';

/** The single GSC operation the research agent needs. */
export type GscQueryFn = (req: GscQueryRequest) => Promise<GscReport>;

/** Production implementation: bind a read-only GscClient to the run's access token. */
export function makeGscQuery(accessToken: string, fetcher?: Fetcher): GscQueryFn {
  const client = new GscClient(fetcher ? { accessToken, fetcher } : { accessToken });
  return (req) => client.query(req);
}
