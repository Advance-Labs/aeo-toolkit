'use client';

/**
 * /login — passwordless magic-link sign-in.
 *
 * Client component: the form calls Supabase `signInWithOtp`, which emails a one-time link that lands
 * on `/auth/callback`. Matches the console design system (dark theme, SpotlightCard, themed Input +
 * Button). Dormant-safe: when auth is not configured ({@link createBrowserSupabase} returns null) the
 * page renders a calm "sign-in isn't enabled yet" state and never errors.
 *
 * (Client component, so no `metadata` export — `/login` is an unlinked, un-sitemapped utility page.)
 */

import { useState, type FormEvent, type JSX } from 'react';
import { Badge, Button, GradientText, Input, Section, SpotlightCard } from '@/components/ui';
import { createBrowserSupabase } from '@/lib/auth/client';
import { SITE_URL } from '@/lib/seo';

type Status =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'sent'; email: string }
  | { kind: 'error'; message: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Login page. Renders one of two layouts: the magic-link form when auth is configured, or a graceful
 * "not enabled yet" notice when it is dormant.
 */
export default function LoginPage(): JSX.Element {
  const supabase = createBrowserSupabase();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (supabase === null) return;

    const trimmed = email.trim();
    if (!EMAIL_RE.test(trimmed)) {
      setStatus({ kind: 'error', message: 'Enter a valid email address.' });
      return;
    }

    setStatus({ kind: 'sending' });
    const { error } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: { emailRedirectTo: `${SITE_URL.replace(/\/$/, '')}/auth/callback` },
    });

    if (error !== null) {
      setStatus({ kind: 'error', message: 'Could not send the sign-in link. Please try again.' });
      return;
    }
    setStatus({ kind: 'sent', email: trimmed });
  }

  return (
    <Section className="pt-12 sm:pt-20">
      <div className="mx-auto flex w-full max-w-md flex-col gap-6">
        <header className="flex flex-col gap-4 text-center">
          <div className="flex justify-center">
            <Badge tone="cyan">Account</Badge>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Sign in to <GradientText>AEO Toolkit</GradientText>
          </h1>
          <p className="text-base leading-relaxed text-slate-400">
            All tools are free and open — an account lets you track usage and manage billing.
          </p>
        </header>

        <SpotlightCard className="p-6 sm:p-8">
          {supabase === null ? (
            <DisabledNotice />
          ) : status.kind === 'sent' ? (
            <SentNotice email={status.email} />
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
              <div className="flex flex-col gap-2">
                <label htmlFor="email" className="text-sm font-medium text-slate-300">
                  Email address
                </label>
                <Input
                  id="email"
                  type="email"
                  name="email"
                  autoComplete="email"
                  inputMode="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={status.kind === 'sending'}
                  required
                />
              </div>

              {status.kind === 'error' ? (
                <p role="alert" className="text-sm text-rose-400">
                  {status.message}
                </p>
              ) : null}

              <Button type="submit" disabled={status.kind === 'sending'} className="w-full">
                {status.kind === 'sending' ? 'Sending link…' : 'Email me a sign-in link'}
              </Button>

              <p className="text-center text-xs leading-relaxed text-slate-500">
                We&rsquo;ll email you a one-time magic link — no password required.
              </p>
            </form>
          )}
        </SpotlightCard>
      </div>
    </Section>
  );
}

/** Graceful dormant state shown when Supabase auth env is not configured. */
function DisabledNotice(): JSX.Element {
  return (
    <div className="flex flex-col gap-3 text-center">
      <h2 className="text-lg font-semibold text-white">Sign-in isn&rsquo;t enabled yet</h2>
      <p className="text-sm leading-relaxed text-slate-400">
        Accounts and billing aren&rsquo;t turned on for this deployment. Every tool is already free and
        open — head back and start auditing.
      </p>
      <div className="mt-2 flex justify-center">
        <Button href="/" variant="secondary">
          Back to the toolkit
        </Button>
      </div>
    </div>
  );
}

/** Confirmation shown after a magic link has been emailed. */
function SentNotice({ email }: { email: string }): JSX.Element {
  return (
    <div className="flex flex-col gap-3 text-center">
      <h2 className="text-lg font-semibold text-white">Check your inbox</h2>
      <p className="text-sm leading-relaxed text-slate-400">
        We sent a one-time sign-in link to <span className="font-medium text-white">{email}</span>.
        Open it on this device to finish signing in.
      </p>
      <p className="text-xs leading-relaxed text-slate-500">
        The link expires shortly. Didn&rsquo;t get it? Check spam, or reload to try again.
      </p>
    </div>
  );
}
