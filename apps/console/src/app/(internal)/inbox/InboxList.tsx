'use client';

import { useState } from 'react';
import type { Proposal } from '@advance-labs/types';

/** Short, human-readable summary of a proposal for the inbox row. */
function summarize(p: Proposal): string {
  switch (p.kind) {
    case 'content':
      return `Article: ${p.payload.title}`;
    case 'link-outreach':
      return `Outreach: ${p.payload.prospectDomain}`;
    default:
      return p.kind;
  }
}

/** Staff approval inbox list. Each decision POSTs to /api/managed/decision (which enforces C2). */
export function InboxList({ initial }: { initial: Proposal[] }): React.ReactElement {
  const [items, setItems] = useState<Proposal[]>(initial);
  const [busy, setBusy] = useState<string | null>(null);

  async function decide(id: string, action: 'approve' | 'reject'): Promise<void> {
    setBusy(id);
    const res = await fetch('/api/managed/decision', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ proposalId: id, action }),
    });
    if (res.ok) {
      setItems((prev) => prev.filter((p) => p.id !== id));
    }
    setBusy(null);
  }

  if (items.length === 0) {
    return <p className="text-sm text-slate-400">No pending proposals.</p>;
  }

  return (
    <ul className="flex flex-col gap-3">
      {items.map((p) => (
        <li
          key={p.id}
          className="flex flex-col gap-3 rounded-xl border border-white/10 bg-white/[0.025] p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-white">{summarize(p)}</p>
            <p className="text-xs text-slate-500">customer {p.customerId}</p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy === p.id}
              onClick={() => decide(p.id, 'approve')}
              className="rounded-lg bg-brand-indigo px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
            >
              Approve
            </button>
            <button
              type="button"
              disabled={busy === p.id}
              onClick={() => decide(p.id, 'reject')}
              className="rounded-lg border border-white/15 px-3 py-1.5 text-sm text-slate-300 disabled:opacity-50"
            >
              Reject
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
