import { defineManifest } from '@crxjs/vite-plugin';
import packageJson from './package.json';

const { version } = packageJson;
// Convert "0.1.0" → "0.1.0" (Chrome accepts up to four dot-separated integers).
const [major = '0', minor = '0', patch = '0'] = version.replace(/[^\d.]/g, '').split('.');

export default defineManifest({
  manifest_version: 3,
  name: 'AEO/GEO Auditor',
  description:
    'Run a client-side AI-readiness (AEO/GEO) audit on the active tab — meta, structured data, robots.txt, sitemap, llms.txt and AI-bot directives — then export a PDF.',
  version: `${major}.${minor}.${patch}`,
  version_name: version,
  action: {
    default_popup: 'src/popup/index.html',
    default_title: 'AEO/GEO Auditor',
  },
  background: {
    service_worker: 'src/background/index.ts',
    type: 'module',
  },
  content_scripts: [
    {
      js: ['src/content/index.ts'],
      matches: ['<all_urls>'],
      run_at: 'document_idle',
    },
  ],
  permissions: ['activeTab', 'scripting'],
  // The audit fetches robots.txt / sitemap.xml / llms.txt from the active
  // tab's own origin. <all_urls> lets the background worker do same-origin
  // file fetches for whatever site the user is auditing.
  host_permissions: ['<all_urls>'],
});
