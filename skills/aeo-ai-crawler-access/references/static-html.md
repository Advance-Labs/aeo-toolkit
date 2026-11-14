# Static HTML / any host

1. Create `robots.txt` in the directory the host serves as the site root (`public/`, `dist/`,
   `docs/`, whatever deploys to `/`). Use the template in the main skill.
2. Make sure the host serves it as `text/plain` and does not rewrite unknown paths to
   `index.html` for it. A single-page-app fallback rule that catches `/robots.txt` makes it
   `text/html`, and the audit then says it is missing.
3. Per-subdomain: each host needs its own robots.txt (`www.example.com`, `blog.example.com`).
   Anthropic's page says to do this for every subdomain you want covered.
4. If the host or CDN has an "AI bots" toggle (Cloudflare has one), check it matches the robots.txt you just wrote.

Verify: `curl -sI https://example.com/robots.txt` shows `200` and `content-type: text/plain`.
