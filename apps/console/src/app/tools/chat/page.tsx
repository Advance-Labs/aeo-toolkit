import type { JSX } from 'react';
import { ChatWorkspace } from '@/components/chat/ChatWorkspace.js';

/**
 * GA4 + Search Console Chat tool. Re-homed from the standalone `ga-gsc-chat` app.
 *
 * The shell layout provides the page `<main>`, so this renders a local header + the
 * interactive {@link ChatWorkspace} island inside a plain wrapper (no nested `<main>`).
 * Connection state is hydrated client-side: the workspace re-fetches `/api/connection`
 * on mount (it owns the cookie + token check server-side), so this page stays a static
 * server component and never touches the OAuth lib directly.
 */
export default function ChatToolPage(): JSX.Element {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <header className="flex flex-col gap-2 border-b border-white/10 pb-4">
        <h1 className="text-2xl font-bold tracking-tight text-white">GA4 + Search Console Chat</h1>
        <p className="text-sm text-slate-400">
          Ask SEO questions grounded in your own Google data, answered by your own LLM key.
        </p>
      </header>
      <ChatWorkspace initialConnected={false} />
    </div>
  );
}
