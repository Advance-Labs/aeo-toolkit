import type { JSX } from 'react';
import { ReportLayout } from '@aeo/ui';
import { EeatScanner } from '@/components/EeatScanner';

/**
 * Home page (server component shell). Renders the shared `ReportLayout` and
 * mounts the interactive `EeatScanner` client component inside it.
 */
export default function HomePage(): JSX.Element {
  return (
    <ReportLayout
      title="E-E-A-T Scanner"
      subtitle="Crawl up to 12 pages and score Experience, Expertise, Authoritativeness, and Trust."
    >
      <EeatScanner />
    </ReportLayout>
  );
}
