import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.config.js';

// MV3 forbids remotely hosted code, and the Chrome Web Store rejects on a string
// match, not on reachability. jsPDF hardcodes a PDFObject CDN URL for its
// `output('pdfobjectnewwindow')` mode. We only ever call `doc.save()`, so that
// branch is dead, but the literal alone got 0.2.0 rejected ("Blue Argon",
// 2026-09-11). Blank it at build time rather than patching node_modules.
const PDFOBJECT_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/pdfobject/2.1.1/pdfobject.min.js';

function stripJspdfRemoteScript(): Plugin {
  return {
    name: 'strip-jspdf-remote-script',
    transform(code, id) {
      if (!id.includes('/jspdf/') || !code.includes(PDFOBJECT_CDN)) return null;
      return { code: code.replaceAll(PDFOBJECT_CDN, ''), map: null };
    },
  };
}

// Fail the build, not the store review, if any chunk still references a remote
// script. Namespace URIs and the doc links the audit engine prints are plain
// text, so only script-shaped URLs and the public JS CDNs count.
const REMOTE_CODE =
  /https?:\/\/(?:[^\s"'`]*\.(?:m?js|wasm)(?=[\s"'`?#)]|$)|(?:cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net|unpkg\.com|esm\.sh)\/)/g;

// Attribution strings inside jsPDF that name a .js file but never load it. Both
// shipped in the rejected 0.2.0 build and were not cited. Exact URLs only, so a
// new remote reference from a dependency upgrade still fails the build.
const ATTRIBUTION_ONLY = new Set([
  'http://www.myersdaily.org/joseph/javascript/md5.js',
  'https://github.com/foliojs/pdfkit/blob/master/lib/security.js',
]);

function forbidRemoteCode(): Plugin {
  return {
    name: 'forbid-remote-code',
    apply: 'build',
    generateBundle(_options, bundle) {
      const hits: string[] = [];
      for (const file of Object.values(bundle)) {
        if (file.type !== 'chunk') continue;
        for (const [url] of file.code.matchAll(REMOTE_CODE)) {
          if (!ATTRIBUTION_ONLY.has(url)) hits.push(`${file.fileName}: ${url}`);
        }
      }
      if (hits.length) {
        this.error(`Remotely hosted code would violate MV3 policy:\n  ${hits.join('\n  ')}`);
      }
    },
  };
}

// The @advance-labs/* workspace packages are bundled into the extension build; there is
// no Node runtime in an MV3 extension, so every dependency must be inlined by
// Vite/Rollup. `cheerio` (pulled in transitively by the parser/validator) is
// pure JS and bundles cleanly for the browser.
export default defineConfig({
  plugins: [stripJspdfRemoteScript(), react(), crx({ manifest }), forbidRemoteCode()],
  build: {
    target: 'esnext',
    rollupOptions: {
      input: {
        // The popup HTML is referenced by the manifest action; CRXJS discovers
        // it automatically, but listing it keeps the entry explicit.
        popup: 'src/popup/index.html',
      },
    },
  },
});
