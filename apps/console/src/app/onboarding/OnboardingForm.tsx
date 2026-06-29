'use client';

import { useState } from 'react';

/** Minimal managed-onboarding form: captures site, niche, topics → POSTs to /api/managed/onboard. */
export function OnboardingForm(): React.ReactElement {
  const [state, setState] = useState<'idle' | 'submitting' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState('');

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setState('submitting');
    const form = new FormData(e.currentTarget);
    const topics = String(form.get('topics') ?? '')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    const res = await fetch('/api/managed/onboard', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        siteUrl: form.get('siteUrl'),
        niche: form.get('niche'),
        topics,
      }),
    });
    if (res.ok) {
      setState('done');
      setMessage('Your site is onboarded. We’ll capture your baseline and start the cadence.');
    } else {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setState('error');
      setMessage(body.error ?? 'Something went wrong.');
    }
  }

  if (state === 'done') {
    return <p className="text-sm text-brand-cyan">{message}</p>;
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm text-slate-300">
        Site URL
        <input
          name="siteUrl"
          type="url"
          required
          placeholder="https://yourbrand.com"
          className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-white"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-slate-300">
        Niche
        <input
          name="niche"
          type="text"
          placeholder="e.g. B2B SaaS analytics"
          className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-white"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-slate-300">
        Target topics (comma-separated)
        <input
          name="topics"
          type="text"
          placeholder="attribution, product analytics, retention"
          className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-white"
        />
      </label>
      <button
        type="submit"
        disabled={state === 'submitting'}
        className="rounded-lg bg-brand-indigo px-4 py-2 font-medium text-white disabled:opacity-60"
      >
        {state === 'submitting' ? 'Onboarding…' : 'Start onboarding'}
      </button>
      {state === 'error' && <p className="text-sm text-red-400">{message}</p>}
    </form>
  );
}
