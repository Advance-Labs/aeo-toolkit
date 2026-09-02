import { defineCollection } from 'astro:content';
import { docsSchema } from '@astrojs/starlight/schema';
import { glob } from 'astro/loaders';

/**
 * Source the site from the repo's own `docs/` directory rather than a copy under
 * `src/content/docs`. Starlight's `docsLoader()` hardcodes its base, so we use Astro's
 * `glob()` loader directly with `docsSchema()`.
 *
 * Why: a duplicated docs tree is how documentation drifts. One directory, two renderers —
 * GitHub reads it raw, Starlight publishes it.
 *
 * `archive/` is excluded: those files are historical by design and carry "do not follow this"
 * banners, so publishing them would undo the point of archiving them.
 *
 * `legal/` is excluded because both files say "NOT LEGAL TEXT — draft skeleton" and are gated on
 * counsel review. On a public docs site they would read as binding terms. They stay in the repo.
 */
export const collections = {
  docs: defineCollection({
    loader: glob({
      base: '../../docs',
      pattern: ['**/[^_]*.{md,mdx}', '!archive/**', '!legal/**'],
      // Two normalisations:
      //  1. docs/ uses SCREAMING-CASE filenames (ARCHITECTURE.md) -> /architecture, not /ARCHITECTURE.
      //  2. README.md becomes the directory index, so docs/README.md is both GitHub's folder
      //     landing page and this site's home page. One file, both readers.
      generateId: ({ entry }) =>
        entry
          .replace(/\.mdx?$/, '')
          .toLowerCase()
          .replace(/(^|\/)readme$/, '$1index'),
    }),
    schema: docsSchema(),
  }),
};
