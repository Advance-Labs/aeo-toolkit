'use client';

import type { JSX } from 'react';
import { Button } from '@/components/ui';

/** Inline Google "G" mark — keeps the connect CTA recognizable without an icon library. */
function GoogleMark(): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.45c-.24 1.4-.95 2.6-2.02 3.4l3.26 2.53c1.9-1.76 3-4.35 3-7.43 0-.72-.07-1.42-.19-2.08H12z"
      />
      <path
        fill="#34A853"
        d="M5.27 14.28l-.74.56-2.6 2.02C3.6 20.06 7.5 22.5 12 22.5c2.7 0 4.96-.9 6.62-2.42l-3.26-2.53c-.9.6-2.05.96-3.36.96-2.58 0-4.77-1.74-5.55-4.09z"
      />
      <path
        fill="#FBBC05"
        d="M2.93 6.62A10.4 10.4 0 0 0 1.5 12c0 1.73.42 3.36 1.43 4.86l3.34-2.58A6.2 6.2 0 0 1 5.93 12c0-.74.13-1.46.34-2.13L2.93 6.62z"
      />
      <path
        fill="#4285F4"
        d="M12 5.84c1.47 0 2.78.5 3.82 1.49l2.86-2.86C16.95 2.78 14.7 1.5 12 1.5 7.5 1.5 3.6 3.94 1.59 7.5l3.68 2.37C6.05 7.52 8.24 5.84 12 5.84z"
        transform="translate(0 0)"
      />
    </svg>
  );
}

/** Anchor that starts the Google OAuth flow by navigating to the server route. */
export function ConnectButton({ connected }: { connected: boolean }): JSX.Element {
  return (
    <Button href="/api/auth/google" variant={connected ? 'secondary' : 'primary'} size="md">
      <GoogleMark />
      {connected ? 'Reconnect Google' : 'Connect Google'}
    </Button>
  );
}
