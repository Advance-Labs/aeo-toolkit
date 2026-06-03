'use client';

/** Anchor that starts the Google OAuth flow by navigating to the server route. */
export function ConnectButton({ connected }: { connected: boolean }) {
  return (
    <a
      href="/api/auth/google"
      className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
    >
      {connected ? 'Reconnect Google' : 'Connect Google'}
    </a>
  );
}
