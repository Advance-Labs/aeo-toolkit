// @ts-check
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import { visit } from 'unist-util-visit';

const SITE = process.env.DOCS_SITE_URL ?? 'https://docs.advancelabs.dev';
const REPO = 'https://github.com/Advance-Labs/aeo-toolkit';
const DOCS_ROOT = fileURLToPath(new URL('../../docs/', import.meta.url));

/**
 * The docs are authored to be readable on GitHub first, so they link to each other with real
 * relative paths (`adr/0003-x.md`) and out to source (`../../packages/scoring`). Neither form
 * is a valid URL on the built site, so rewrite both at build time:
 *
 *   - a link to another published doc  -> its site route (`/adr/0003-x`)
 *   - a link outside `docs/`, or into the unpublished `archive/`, -> the file on GitHub
 *
 * This keeps one set of links correct in both renderers instead of forcing a choice.
 */
function rehypeRepoAwareLinks() {
  return (/** @type {any} */ tree, /** @type {any} */ file) => {
    const currentAbs = file.history?.[0] ?? file.path;
    if (!currentAbs) return;

    visit(tree, 'element', (/** @type {any} */ node) => {
      if (node.tagName !== 'a') return;
      const href = node.properties?.href;
      if (typeof href !== 'string' || !href) return;
      // Leave protocol-relative, absolute, mailto/http, and pure anchors alone.
      if (/^([a-z][a-z0-9+.-]*:|\/\/|#|\/)/i.test(href)) return;

      const [rawPath, hash] = href.split('#');
      if (!rawPath) return;

      const targetAbs = path.resolve(path.dirname(currentAbs), rawPath);
      const rel = path.relative(DOCS_ROOT, targetAbs).split(path.sep).join('/');
      const outsideDocs = rel.startsWith('..');
      const isArchived = rel.startsWith('archive/');
      const isMarkdown = /\.mdx?$/i.test(rawPath);

      if (!outsideDocs && !isArchived && isMarkdown) {
        const slug = rel
          .replace(/\.mdx?$/i, '')
          .toLowerCase()
          .replace(/(^|\/)index$/, '');
        node.properties.href = `/${slug}${hash ? `#${hash}` : ''}`;
        return;
      }

      // Everything else lives in the repo, not on this site: point at GitHub.
      const repoRel = path
        .relative(fileURLToPath(new URL('../../', import.meta.url)), targetAbs)
        .split(path.sep)
        .join('/');
      const kind = /\.[a-z0-9]+$/i.test(repoRel) ? 'blob' : 'tree';
      node.properties.href = `${REPO}/${kind}/main/${repoRel}${hash ? `#${hash}` : ''}`;
    });
  };
}

export default defineConfig({
  site: SITE,
  markdown: { rehypePlugins: [rehypeRepoAwareLinks] },
  integrations: [
    starlight({
      title: 'AEO Toolkit',
      description:
        'Open-source TypeScript suite for Answer Engine Optimization — audit, score, and track how AI assistants cite your site.',
      lastUpdated: true,
      // Starlight resolves each entry's filePath against this baseUrl as a URL. Because the
      // content lives outside the app, that filePath is `../../docs/<file>.md`, and the `../../`
      // consumes two segments of the base path. Ending the base at `apps/docs/` therefore lands
      // on `/edit/main/docs/<file>.md`, which is the file's real location on the default branch.
      editLink: { baseUrl: `${REPO}/edit/main/apps/docs/` },
      social: [{ icon: 'github', label: 'GitHub', href: REPO }],
      head: [
        { tag: 'meta', attrs: { property: 'og:site_name', content: 'AEO Toolkit Docs' } },
        // The toolkit teaches AI-crawler access, so the docs allow them explicitly.
        {
          tag: 'meta',
          attrs: { name: 'robots', content: 'index, follow, max-snippet:-1, max-image-preview:large' },
        },
      ],
      sidebar: [
        {
          label: 'Start here',
          items: [
            { label: 'Overview', link: '/' },
            { label: 'Architecture', slug: 'architecture' },
          ],
        },
        { label: 'Reference', autogenerate: { directory: 'reference' } },
        {
          label: 'Operating the console',
          items: [
            { label: 'Self-hosting', slug: 'self_hosting' },
            { label: 'Deployment', slug: 'deployment' },
            { label: 'Activation', slug: 'activation' },
          ],
        },
        {
          label: 'Contributing',
          items: [{ label: 'Conventions', slug: 'conventions' }],
        },
        {
          label: 'Background',
          items: [
            { label: 'Visibility tracking', slug: 'visibility-tracking' },
            { label: 'SEO + AEO plan', slug: 'seo-aeo-plan' },
          ],
        },
        { label: 'Decisions', autogenerate: { directory: 'adr' } },
      ],
    }),
  ],
});
