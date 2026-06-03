/**
 * Server-only environment access for the Google OAuth flow.
 *
 * Reads the three required Google credentials from `process.env`. Throwing here (rather than at
 * module load) keeps the rest of the app importable in environments where the credentials are not
 * configured — the error surfaces only when an OAuth route actually runs.
 */

export interface GoogleEnv {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export class MissingEnvError extends Error {
  constructor(public readonly variable: string) {
    super(`Missing required environment variable: ${variable}`);
    this.name = 'MissingEnvError';
  }
}

function required(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.length === 0) {
    throw new MissingEnvError(name);
  }
  return value;
}

/**
 * Resolve the Google OAuth credentials from the server environment. Call only inside route handlers
 * (Node runtime) — never from a client component. `GOOGLE_REDIRECT_URI` must point at
 * `/api/auth/google/callback`.
 */
export function googleEnv(): GoogleEnv {
  return {
    clientId: required('GOOGLE_CLIENT_ID'),
    clientSecret: required('GOOGLE_CLIENT_SECRET'),
    redirectUri: required('GOOGLE_REDIRECT_URI'),
  };
}
