# Plain HTML, and Vite / CRA single-page apps

## Plain static HTML

Already fine. The content you write in the file is the content that is served. Check only for
text injected by an inline script (a testimonials widget, a `fetch` that fills a list). Move
that text into the markup, or generate the HTML at build time.

## Vite / Create React App SPA

An SPA ships `index.html` with `<div id="root"></div>` and a bundle. Every route serves that
same file. Three options, cheapest first:

1. **Prerender the public routes at build time.** Output real HTML per route, keep hydration.
   - Vite: `vite-plugin-ssr` / Vike, or the framework's own SSG (React Router framework mode
     supports prerendering listed paths; TanStack Start and similar do too). Check the current
     docs for the exact config key before copying one: it has changed across versions.
   - A script-based prerender (a headless browser visits each route after build and saves the
     DOM) works for small sites: Puppeteer/Playwright, loop over a route list, write
     `dist/<route>/index.html`. Serve those files before the SPA fallback.
2. **Move to a framework with SSR/SSG** (Next.js, Astro, Remix/React Router, Nuxt, SvelteKit)
   for the public pages. Keep the SPA for the logged-in app on a subdomain or path.
3. **Dynamic rendering / prerender service** as a stopgap. Google lists it as a workaround,
   not a recommendation, and the output must match what users see.

Whichever you pick, make sure the host serves the prerendered file for the route before it
falls back to `index.html`. On Netlify/Vercel/Cloudflare Pages that means static files take
priority over the SPA rewrite rule; check the rewrite is `/* -> /index.html` as a **fallback**.

Put `<title>`, meta description, canonical and JSON-LD in the prerendered HTML too. Setting them
only with `react-helmet` at runtime leaves them out of the served document.

**Verify:** `curl -s https://example.com/some/route | grep -c "your headline"` for a deep
route, not just `/`.
