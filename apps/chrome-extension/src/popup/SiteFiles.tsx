import type { JSX } from 'react';
import type { SiteFilePresence } from '@advance-labs/types';

export interface SiteFilesProps {
  presence: SiteFilePresence;
}

const FILES: ReadonlyArray<{ key: keyof SiteFilePresence; label: string }> = [
  { key: 'robotsTxt', label: 'robots.txt' },
  { key: 'sitemapXml', label: 'sitemap.xml' },
  { key: 'llmsTxt', label: 'llms.txt' },
  { key: 'llmsFullTxt', label: 'llms-full.txt' },
  { key: 'favicon', label: 'favicon' },
];

/** Compact presence grid for the origin's crawl-hint / trust files. */
export function SiteFiles({ presence }: SiteFilesProps): JSX.Element {
  return (
    <section className="sitefiles">
      <h2 className="section-title">Site files</h2>
      <div className="sitefiles-grid">
        {FILES.map(({ key, label }) => {
          const present = presence[key];
          return (
            <span key={key} className={present ? 'sf sf-yes' : 'sf sf-no'}>
              <span aria-hidden="true">{present ? '✓' : '✕'}</span> {label}
            </span>
          );
        })}
      </div>
    </section>
  );
}
