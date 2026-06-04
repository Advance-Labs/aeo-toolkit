'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent, JSX } from 'react';
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
import { Button, Input, Reveal, SpotlightCard } from '@/components/ui';
import { cn } from '@/lib/cn';

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

/** Shared dark field style for the native <select> elements (Input covers <input>). */
const SELECT_CLASS =
  'h-12 w-full appearance-none rounded-xl border border-white/[0.12] bg-white/[0.04] px-4 pr-10 text-[15px] text-white outline-none transition focus:border-brand-cyan/60 focus:bg-white/[0.06] focus:ring-2 focus:ring-brand-cyan/20 [&>option]:bg-ink-900 [&>option]:text-white';

function FieldLabel({ children }: { children: string }): JSX.Element {
  return (
    <span className="text-xs font-medium uppercase tracking-wide text-slate-400">{children}</span>
  );
}

function ChevronIcon(): JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function StepBadge({ n }: { n: number }): JSX.Element {
  return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-sm font-semibold text-brand-cyan">
      {n}
    </span>
  );
}

function StatusDot({ ok }: { ok: boolean }): JSX.Element {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-block h-2 w-2 rounded-full',
        ok ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]' : 'bg-slate-500',
      )}
    />
  );
}

/** A glassy panel that wraps each configuration step. */
function Panel({
  step,
  title,
  description,
  action,
  children,
}: {
  step: number;
  title: string;
  description?: string;
  action?: JSX.Element;
  children?: JSX.Element;
}): JSX.Element {
  return (
    <section className="surface p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <StepBadge n={step} />
          <div className="flex flex-col gap-1">
            <h2 className="text-base font-semibold text-white">{title}</h2>
            {description ? (
              <p className="text-sm leading-relaxed text-slate-400">{description}</p>
            ) : null}
          </div>
        </div>
        {action ? <div className="shrink-0 sm:pl-4">{action}</div> : null}
      </div>
      {children ? <div className="mt-5">{children}</div> : null}
    </section>
  );
}

/** Renders a single user→assistant exchange as a chat thread entry. */
function ChatBubble({ turn }: { turn: ChatTurn }): JSX.Element {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-md bg-[linear-gradient(110deg,rgba(99,102,241,0.22),rgba(139,92,246,0.18))] px-4 py-2.5 text-[15px] leading-relaxed text-white ring-1 ring-white/10">
          {turn.question}
        </div>
      </div>
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[linear-gradient(135deg,#6366F1,#22D3EE)] text-[11px] font-bold text-white"
        >
          AI
        </span>
        <div className="min-w-0 flex-1 rounded-2xl rounded-tl-md border border-white/[0.08] bg-white/[0.025] px-4 py-3">
          {turn.pending ? (
            <p className="flex items-center gap-2 text-sm text-slate-400" aria-live="polite">
              <span className="flex gap-1">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-cyan [animation-delay:0ms]" />
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-violet [animation-delay:150ms]" />
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-indigo [animation-delay:300ms]" />
              </span>
              Analyzing your data…
            </p>
          ) : null}
          {turn.error ? (
            <p role="alert" className="text-sm text-red-300">
              {turn.error}
            </p>
          ) : null}
          {turn.answer ? (
            <pre className="whitespace-pre-wrap break-words font-sans text-[15px] leading-relaxed text-slate-200">
              {turn.answer}
            </pre>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function ChatWorkspace({ initialConnected }: { initialConnected: boolean }): JSX.Element {
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

  const threadEndRef = useRef<HTMLDivElement>(null);

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

  // Keep the latest turn in view as the thread grows.
  useEffect(() => {
    if (turns.length === 0) return;
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [turns]);

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
    <div className="flex flex-col gap-5">
      {/* 1. Connect Google */}
      <Reveal>
        <Panel
          step={1}
          title="Connect Google"
          description="Read-only access to your GA4 and Search Console data. We never write or store your reports."
          action={
            <div className="flex flex-col items-start gap-2 sm:items-end">
              <ConnectButton connected={connected} />
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400">
                <StatusDot ok={connected} />
                {connected ? 'Connected' : 'Not connected'}
              </span>
            </div>
          }
        />
      </Reveal>

      {/* 2. Pick data sources */}
      <Reveal delay={0.05}>
        <Panel
          step={2}
          title="Pick data sources"
          description="Choose the property and site the assistant should ground its answers in."
        >
          <div className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5">
                <FieldLabel>Search Console site</FieldLabel>
                {sites.length > 0 ? (
                  <div className="relative">
                    <select
                      className={SELECT_CLASS}
                      value={siteUrl}
                      onChange={(e) => setSiteUrl(e.target.value)}
                    >
                      {sites.map((s) => (
                        <option key={s.siteUrl} value={s.siteUrl}>
                          {s.siteUrl}
                        </option>
                      ))}
                    </select>
                    <ChevronIcon />
                  </div>
                ) : (
                  <Input
                    placeholder="https://example.com/"
                    value={siteUrl}
                    onChange={(e) => setSiteUrl(e.target.value)}
                  />
                )}
              </label>

              <label className="flex flex-col gap-1.5">
                <FieldLabel>GA4 property ID</FieldLabel>
                {properties.length > 0 ? (
                  <div className="relative">
                    <select
                      className={SELECT_CLASS}
                      value={propertyId}
                      onChange={(e) => setPropertyId(e.target.value)}
                    >
                      {properties.map((p) => (
                        <option key={p.propertyId} value={p.propertyId}>
                          {p.displayName} ({p.propertyId})
                        </option>
                      ))}
                    </select>
                    <ChevronIcon />
                  </div>
                ) : (
                  <Input
                    placeholder="123456789"
                    value={propertyId}
                    onChange={(e) => setPropertyId(e.target.value)}
                  />
                )}
              </label>
            </div>
            {properties.length === 0 ? (
              <p className="text-xs leading-relaxed text-slate-400">
                Property listing requires the GA4 Admin API (not yet wired) — enter your numeric
                property ID manually.
              </p>
            ) : null}
          </div>
        </Panel>
      </Reveal>

      {/* 3. Bring your own LLM key */}
      <Reveal delay={0.1}>
        <Panel
          step={3}
          title="Bring your own LLM key"
          description="Your key is sent only with the request and is never stored on the server."
        >
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="flex flex-col gap-1.5">
              <FieldLabel>Provider</FieldLabel>
              <div className="relative">
                <select
                  className={SELECT_CLASS}
                  value={provider}
                  onChange={(e) => onProviderChange(e.target.value as LlmProvider)}
                >
                  {PROVIDER_OPTIONS.map((o) => (
                    <option key={o.provider} value={o.provider}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <ChevronIcon />
              </div>
            </label>
            <label className="flex flex-col gap-1.5">
              <FieldLabel>Model</FieldLabel>
              <Input value={model} onChange={(e) => setModel(e.target.value)} />
            </label>
            <label className="flex flex-col gap-1.5">
              <FieldLabel>API key</FieldLabel>
              <Input
                type="password"
                autoComplete="off"
                placeholder="sk-… / your provider key"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
            </label>
          </div>
        </Panel>
      </Reveal>

      {/* 4. Ask — presets + thread + composer */}
      <Reveal delay={0.15}>
        <section className="surface flex flex-col gap-5 p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <StepBadge n={4} />
            <div className="flex flex-col gap-1">
              <h2 className="text-base font-semibold text-white">Ask your data</h2>
              <p className="text-sm leading-relaxed text-slate-400">
                Start from a preset or type your own question below.
              </p>
            </div>
          </div>

          {/* Preset prompt cards */}
          <div className="grid gap-3 sm:grid-cols-2">
            {PRESET_PROMPTS.map((preset) => (
              <SpotlightCard key={preset.id}>
                <button
                  type="button"
                  disabled={!canAsk}
                  onClick={() => void ask(preset.question)}
                  className="flex w-full flex-col items-start gap-1 p-4 text-left transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className="text-sm font-semibold text-white">{preset.title}</span>
                  <span className="text-xs leading-relaxed text-slate-400">
                    {preset.description}
                  </span>
                </button>
              </SpotlightCard>
            ))}
          </div>

          {/* Chat thread */}
          <div
            aria-live="polite"
            className="flex flex-col gap-6 rounded-2xl border border-white/[0.06] bg-black/20 p-4 sm:p-5"
          >
            {turns.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <svg
                  viewBox="0 0 24 24"
                  width="28"
                  height="28"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  className="text-slate-600"
                >
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                <p className="text-sm text-slate-400">
                  No questions yet. Pick a preset or type one below.
                </p>
              </div>
            ) : (
              <>
                {turns.map((turn) => (
                  <ChatBubble key={turn.id} turn={turn} />
                ))}
                <div ref={threadEndRef} />
              </>
            )}
          </div>

          {/* Composer */}
          <form onSubmit={onSubmit} className="flex flex-col gap-2">
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                aria-label="Ask a question about your GA4 and Search Console data"
                placeholder="Ask a question about your GA4 + Search Console data…"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                className="flex-1"
              />
              <Button type="submit" size="md" disabled={!canAsk || draft.trim() === ''}>
                <svg
                  viewBox="0 0 24 24"
                  width="16"
                  height="16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="m22 2-7 20-4-9-9-4Z" />
                  <path d="M22 2 11 13" />
                </svg>
                Send
              </Button>
            </div>
            {!canAsk ? (
              <p className="text-xs text-amber-300/90">
                Connect Google, pick a site + property, and enter an API key to start asking.
              </p>
            ) : null}
          </form>
        </section>
      </Reveal>
    </div>
  );
}
