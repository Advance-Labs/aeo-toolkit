import type { Metadata } from 'next';
import { Section } from '@/components/ui';
import { managedEnabled } from '@/lib/managed/staff';
import { OnboardingForm } from './OnboardingForm';

export const metadata: Metadata = {
  title: 'Managed Onboarding — AEO Toolkit',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/** Managed-tier onboarding: capture the customer's site/niche/topics and seed the autopilot cadence. */
export default function OnboardingPage(): React.ReactElement {
  return (
    <Section>
      <div className="mx-auto flex max-w-xl flex-col gap-6">
        <div className="flex flex-col gap-2">
          <span className="eyebrow">Managed · Autopilot</span>
          <h1 className="text-3xl font-semibold tracking-tight text-white">Onboard your site</h1>
          <p className="text-sm leading-relaxed text-slate-400">
            We’ll analyze your site, capture a visibility baseline for the 90-day work-delivered
            guarantee, and start the human-vetted content + outreach cadence.
          </p>
        </div>
        {managedEnabled() ? (
          <OnboardingForm />
        ) : (
          <p className="rounded-lg border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-400">
            The Managed tier isn’t enabled on this workspace yet. Contact us to get set up.
          </p>
        )}
      </div>
    </Section>
  );
}
