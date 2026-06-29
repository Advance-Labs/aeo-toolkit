import type { Metadata } from 'next';
import { Section } from '@/components/ui';
import { getUser } from '@/lib/auth/server';
import { managedEnabled, isStaff } from '@/lib/managed/staff';
import { createServiceClient, listPendingProposals } from '@/lib/managed/data';
import { InboxList } from './InboxList';

export const metadata: Metadata = {
  title: 'Approval Inbox — AEO Toolkit',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/**
 * Internal staff approval inbox. Staff-gated (the page guards display; the decision API independently
 * re-checks authorization per proposal — security C2). Inert when the managed tier is dormant.
 */
export default async function InboxPage(): Promise<React.ReactElement> {
  const notice = (text: string): React.ReactElement => (
    <Section>
      <p className="mx-auto max-w-xl text-sm text-slate-400">{text}</p>
    </Section>
  );

  if (!managedEnabled()) return notice('The Managed tier isn’t enabled on this workspace.');

  const user = await getUser();
  if (user === null || !isStaff(user.email)) {
    return notice('This area is restricted to Advance Labs staff.');
  }

  const client = createServiceClient();
  const proposals = client === null ? [] : await listPendingProposals(client);

  return (
    <Section>
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <div className="flex flex-col gap-2">
          <span className="eyebrow">Internal · Approval inbox</span>
          <h1 className="text-3xl font-semibold tracking-tight text-white">Pending proposals</h1>
          <p className="text-sm leading-relaxed text-slate-400">
            Human-vet each item before it ships. Approving content publishes the sanitized draft;
            approving outreach hands the vetted pitch to you to send.
          </p>
        </div>
        <InboxList initial={proposals} />
      </div>
    </Section>
  );
}
