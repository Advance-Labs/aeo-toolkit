import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.config.js';

// The @advance-labs/* workspace packages are bundled into the extension build; there is
// no Node runtime in an MV3 extension, so every dependency must be inlined by
// Vite/Rollup. `cheerio` (pulled in transitively by the parser/validator) is
// pure JS and bundles cleanly for the browser.
export default defineConfig({
  plugins: [react(), crx({ manifest })],
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
