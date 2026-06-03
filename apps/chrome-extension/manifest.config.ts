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
  // PNGs are generated from src/icons/icon.svg by scripts/generate-icons.mjs
  // into public/icons/. Vite serves public/ from the build root, so the files
  // land at dist/icons/* — manifest paths are relative to the project root and
  // must start with a letter (no `public/` prefix). Chrome MV3 requires raster
  // icons here; SVG is not accepted for the toolbar or store listing.
  icons: {
    16: 'icons/icon-16.png',
    48: 'icons/icon-48.png',
    128: 'icons/icon-128.png',
  },
  action: {
    default_popup: 'src/popup/index.html',
    default_title: 'AEO/GEO Auditor',
    default_icon: {
      16: 'icons/icon-16.png',
      48: 'icons/icon-48.png',
      128: 'icons/icon-128.png',
    },
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
