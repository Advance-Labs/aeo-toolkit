'use client';

import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import type { Ga4Property, GscSite, LlmProvider } from '@aeo/types';
import type {
  ChatRequestBody,
  ChatResponseBody,
  ChatErrorBody,
  ConnectionResponse,
} from '@/components/chat/chat-types.js';
import { PRESET_PROMPTS } from '@/components/chat/presets.js';
import { PROVIDER_OPTIONS, defaultModelFor } from '@/components/chat/models.js';
import { ConnectButton } from '@/components/chat/ConnectButton.js';

interface ChatTurn {
  id: string;
  question: string;
  answer: string | null;
  error: string | null;
  pending: boolean;
}

function newId(): string {
  return Math.random().toString(36).slice(2);
}

export function ChatWorkspace({ initialConnected }: { initialConnected: boolean }) {
  const [connected, setConnected] = useState(initialConnected);
  const [sites, setSites] = useState<GscSite[]>([]);
  const [properties, setProperties] = useState<Ga4Property[]>([]);
  const [siteUrl, setSiteUrl] = useState('');
  const [propertyId, setPropertyId] = useState('');

  const [provider, setProvider] = useState<LlmProvider>('anthropic');
  const [model, setModel] = useState(defaultModelFor('anthropic'));
  const [apiKey, setApiKey] = useState('');

  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [draft, setDraft] = useState('');

  const loadConnection = useCallback(async () => {
    try {
      const res = await fetch('/api/connection', { cache: 'no-store' });
      if (!res.ok) return;
      const data = (await res.json()) as ConnectionResponse;
      setConnected(data.connected);
      setSites(data.sites);
      setProperties(data.properties);
      if (data.sites.length > 0 && siteUrl === '') {
        const first = data.sites[0];
        if (first) setSiteUrl(first.siteUrl);
      }
      if (data.properties.length > 0 && propertyId === '') {
        const first = data.properties[0];
        if (first) setPropertyId(first.propertyId);
      }
    } catch {
      // Non-fatal: leave current state; the user can retry by reconnecting.
    }
  }, [siteUrl, propertyId]);

  useEffect(() => {
    void loadConnection();
    // Intentionally run once on mount; loadConnection captures current setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onProviderChange = useCallback((next: LlmProvider) => {
    setProvider(next);
    setModel(defaultModelFor(next));
  }, []);

  const ask = useCallback(
    async (question: string) => {
      const trimmed = question.trim();
      if (trimmed === '') return;
      if (!connected) return;

      const id = newId();
      setTurns((prev) => [
        ...prev,
        { id, question: trimmed, answer: null, error: null, pending: true },
      ]);

      const body: ChatRequestBody = {
        question: trimmed,
        propertyId,
        siteUrl,
        llmProvider: provider,
        model,
        apiKey,
      };

      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = (await res.json()) as ChatResponseBody | ChatErrorBody;
        setTurns((prev) =>
          prev.map((t) => {
            if (t.id !== id) return t;
            if (!res.ok || 'error' in data) {
              const message = 'error' in data ? data.error : 'Request failed.';
              return { ...t, pending: false, error: message };
            }
            return { ...t, pending: false, answer: data.answer };
          }),
        );
      } catch {
        setTurns((prev) =>
          prev.map((t) =>
            t.id === id ? { ...t, pending: false, error: 'Network error. Try again.' } : t,
          ),
        );
      }
    },
    [connected, propertyId, siteUrl, provider, model, apiKey],
  );

  const onSubmit = useCallback(
    (event: FormEvent) => {
      event.preventDefault();
      void ask(draft);
      setDraft('');
    },
    [ask, draft],
  );

  const canAsk =
    connected && siteUrl.trim() !== '' && propertyId.trim() !== '' && apiKey.trim() !== '';

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">1. Connect Google</h2>
            <p className="text-sm text-slate-500">
              Read-only GA4 + Search Console access. {connected ? 'Connected.' : 'Not connected.'}
            </p>
          </div>
          <ConnectButton connected={connected} />
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-base font-semibold text-slate-900">2. Pick data sources</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">Search Console site</span>
            {sites.length > 0 ? (
              <select
                className="rounded-md border border-slate-300 px-3 py-2"
                value={siteUrl}
                onChange={(e) => setSiteUrl(e.target.value)}
              >
                {sites.map((s) => (
                  <option key={s.siteUrl} value={s.siteUrl}>
                    {s.siteUrl}
                  </option>
                ))}
              </select>
            ) : (
              <input
                className="rounded-md border border-slate-300 px-3 py-2"
                placeholder="https://example.com/"
                value={siteUrl}
                onChange={(e) => setSiteUrl(e.target.value)}
              />
            )}
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">GA4 property ID</span>
            {properties.length > 0 ? (
              <select
                className="rounded-md border border-slate-300 px-3 py-2"
                value={propertyId}
                onChange={(e) => setPropertyId(e.target.value)}
              >
                {properties.map((p) => (
                  <option key={p.propertyId} value={p.propertyId}>
                    {p.displayName} ({p.propertyId})
                  </option>
                ))}
              </select>
            ) : (
              <input
                className="rounded-md border border-slate-300 px-3 py-2"
                placeholder="123456789"
                value={propertyId}
                onChange={(e) => setPropertyId(e.target.value)}
              />
            )}
          </label>
        </div>
        {properties.length === 0 && (
          <p className="mt-2 text-xs text-slate-400">
            Property listing requires the GA4 Admin API (not yet wired) — enter your numeric
            property ID manually.
          </p>
        )}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-1 text-base font-semibold text-slate-900">3. Bring your own LLM key</h2>
        <p className="mb-3 text-xs text-slate-400">
          Your key is sent only with the request and is never stored on the server.
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">Provider</span>
            <select
              className="rounded-md border border-slate-300 px-3 py-2"
              value={provider}
              onChange={(e) => onProviderChange(e.target.value as LlmProvider)}
            >
              {PROVIDER_OPTIONS.map((o) => (
                <option key={o.provider} value={o.provider}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">Model</span>
            <input
              className="rounded-md border border-slate-300 px-3 py-2"
              value={model}
              onChange={(e) => setModel(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">API key</span>
            <input
              type="password"
              autoComplete="off"
              className="rounded-md border border-slate-300 px-3 py-2"
              placeholder="sk-… / your provider key"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </label>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-base font-semibold text-slate-900">4. Ask</h2>
        <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {PRESET_PROMPTS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              disabled={!canAsk}
              onClick={() => void ask(preset.question)}
              className="flex flex-col gap-1 rounded-md border border-slate-200 p-3 text-left transition-colors hover:border-blue-400 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className="text-sm font-semibold text-slate-800">{preset.title}</span>
              <span className="text-xs text-slate-500">{preset.description}</span>
            </button>
          ))}
        </div>

        <form onSubmit={onSubmit} className="flex gap-2">
          <input
            className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
            placeholder="Ask a question about your GA4 + Search Console data…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <button
            type="submit"
            disabled={!canAsk || draft.trim() === ''}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Send
          </button>
        </form>
        {!canAsk && (
          <p className="mt-2 text-xs text-amber-600">
            Connect Google, pick a site + property, and enter an API key to start asking.
          </p>
        )}
      </section>

      <section className="flex flex-col gap-4">
        {turns.length === 0 && (
          <p className="text-sm text-slate-400">
            No questions yet. Pick a preset or type one above.
          </p>
        )}
        {turns.map((turn) => (
          <article
            key={turn.id}
            className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
          >
            <p className="mb-2 text-sm font-semibold text-slate-900">{turn.question}</p>
            {turn.pending && <p className="text-sm text-slate-400">Analyzing your data…</p>}
            {turn.error && <p className="text-sm text-red-600">{turn.error}</p>}
            {turn.answer && (
              <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-slate-700">
                {turn.answer}
              </pre>
            )}
          </article>
        ))}
      </section>
    </div>
  );
}
