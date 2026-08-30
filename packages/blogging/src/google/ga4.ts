/**
 * Typed seam over `@advance-labs/google-api`'s Ga4Client.
 *
 * The monitor agent depends on the `Ga4ReportFn` type, not the concrete client, so tests inject
 * a mock. `makeGa4Report` is the production wiring.
 */
import { Ga4Client } from '@advance-labs/google-api';
import type { Fetcher } from '@advance-labs/google-api';
import type { Ga4Report, Ga4ReportRequest } from '@advance-labs/types';

/** The single GA4 operation the monitor agent needs. */
export type Ga4ReportFn = (req: Ga4ReportRequest) => Promise<Ga4Report>;

/** Production implementation: bind a read-only Ga4Client to the run's access token. */
export function makeGa4Report(accessToken: string, fetcher?: Fetcher): Ga4ReportFn {
  const client = new Ga4Client(fetcher ? { accessToken, fetcher } : { accessToken });
  return (req) => client.runReport(req);
}
