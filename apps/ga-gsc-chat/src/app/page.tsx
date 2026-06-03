/**
 * Home page (server component). Determines connection status server-side from the user cookie +
 * token store, then renders the interactive {@link ChatWorkspace} client island inside the shared
 * {@link ReportLayout} shell. The workspace re-fetches `/api/connection` on mount to hydrate the
 * site/property pickers.
 */
import { cookies } from 'next/headers';
import { ReportLayout } from '@aeo/ui';
import { getValidAccessToken, USER_COOKIE } from '@/lib/oauth';
import { ChatWorkspace } from '@/components/ChatWorkspace';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function isConnected(): Promise<boolean> {
  const cookieStore = await cookies();
  const userId = cookieStore.get(USER_COOKIE)?.value;
  if (!userId) return false;
  try {
    return (await getValidAccessToken(userId)) !== null;
  } catch {
    return false;
  }
}

export default async function HomePage() {
  const connected = await isConnected();

  return (
    <ReportLayout
      title="GA4 + Search Console Chat"
      subtitle="Ask SEO questions grounded in your own Google data, answered by your own LLM key."
    >
      <div className="mx-auto w-full max-w-3xl px-4 py-6">
        <ChatWorkspace initialConnected={connected} />
      </div>
    </ReportLayout>
  );
}
