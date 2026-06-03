import { describe, expect, it } from 'vitest';
import type { LlmsTxtManifest, ParsedHtml } from '@aeo/types';
import { LLMS_TXT_SPEC_VERSION, renderLlmsFullTxt, renderLlmsTxt } from './render.js';

function manifest(overrides: Partial<LlmsTxtManifest> = {}): LlmsTxtManifest {
  return {
    siteName: 'Example',
    summary: 'A helpful example site.',
    sections: [
      {
        heading: 'Docs',
        entries: [
          {
            title: 'Getting Started',
            url: 'https://example.com/docs/start',
            description: 'How to begin.',
          },
          { title: 'API Reference', url: 'https://example.com/docs/api' },
        ],
      },
    ],
    ...overrides,
  };
}

function parsedPage(url: string, title: string, description?: string): ParsedHtml {
  return {
    url,
    meta: {
      title,
      titleLength: title.length,
      description,
      descriptionLength: description?.length ?? 0,
    },
    openGraph: { complete: false },
    twitter: {},
    headings: [],
    headingHierarchyValid: true,
    images: [],
    imageAltCoverage: 0,
    links: [],
    internalLinkCount: 0,
    externalLinkCount: 0,
    content: {
      wordCount: 0,
      hasFaq: false,
      hasHowTo: false,
      questionHeadingCount: 0,
      paragraphCount: 0,
      listCount: 0,
      tableCount: 0,
    },
    rawStructuredData: [],
  };
}

describe('renderLlmsTxt', () => {
  it('renders the H1, summary blockquote, section heading, and bullets', () => {
    const out = renderLlmsTxt(manifest());

    expect(out).toContain(`<!-- llms.txt — llmstxt.org spec ${LLMS_TXT_SPEC_VERSION} -->`);
    expect(out).toContain('# Example');
    expect(out).toContain('> A helpful example site.');
    expect(out).toContain('## Docs');
    expect(out).toContain('- [Getting Started](https://example.com/docs/start): How to begin.');
    // Entry without a description renders without the trailing colon segment.
    expect(out).toContain('- [API Reference](https://example.com/docs/api)\n');
    expect(out.endsWith('\n')).toBe(true);
  });

  it('omits the summary blockquote when no summary is present', () => {
    const out = renderLlmsTxt(manifest({ summary: undefined }));
    // No markdown blockquote line should be emitted. (Check for a line starting with "> ",
    // not a bare ">", since the spec-provenance HTML comment header legitimately contains "-->".)
    expect(out).not.toMatch(/^> /m);
    expect(out).toContain('# Example');
  });

  it('skips empty sections and renders contact + license trailers', () => {
    const out = renderLlmsTxt(
      manifest({
        sections: [
          { heading: 'Docs', entries: [] },
          {
            heading: 'Blog',
            entries: [{ title: 'Hello', url: 'https://example.com/blog/hello' }],
          },
        ],
        contact: 'hi@example.com',
        license: 'MIT',
      }),
    );

    expect(out).not.toContain('## Docs');
    expect(out).toContain('## Blog');
    expect(out).toContain('## Contact');
    expect(out).toContain('hi@example.com');
    expect(out).toContain('## License');
    expect(out).toContain('MIT');
  });

  it('collapses multiline titles/descriptions onto a single bullet line', () => {
    const out = renderLlmsTxt(
      manifest({
        sections: [
          {
            heading: 'Docs',
            entries: [
              {
                title: 'Multi\nLine\tTitle',
                url: 'https://example.com/x',
                description: 'Line one.\nLine two.',
              },
            ],
          },
        ],
      }),
    );
    expect(out).toContain('- [Multi Line Title](https://example.com/x): Line one. Line two.');
  });

  it('falls back to "Website" when the site name is blank', () => {
    const out = renderLlmsTxt(manifest({ siteName: '   ' }));
    expect(out).toContain('# Website');
  });
});

describe('renderLlmsFullTxt', () => {
  it('inlines one section per page with source URL and description', () => {
    const pages: ParsedHtml[] = [
      parsedPage('https://example.com/docs/start', 'Getting Started', 'How to begin.'),
      parsedPage('https://example.com/docs/api', 'API Reference'),
    ];
    const out = renderLlmsFullTxt(manifest(), pages);

    expect(out).toContain('# Example');
    expect(out).toContain('## Getting Started');
    expect(out).toContain('Source: https://example.com/docs/start');
    expect(out).toContain('How to begin.');
    expect(out).toContain('## API Reference');
    expect(out).toContain('Source: https://example.com/docs/api');
  });

  it('prefers curated manifest titles/descriptions over raw page meta', () => {
    const pages: ParsedHtml[] = [
      parsedPage('https://example.com/docs/start', 'Raw <title>', 'Raw meta description'),
    ];
    const curated = manifest({
      sections: [
        {
          heading: 'Docs',
          entries: [
            {
              title: 'Curated Title',
              url: 'https://example.com/docs/start',
              description: 'Curated description.',
            },
          ],
        },
      ],
    });
    const out = renderLlmsFullTxt(curated, pages);
    expect(out).toContain('## Curated Title');
    expect(out).toContain('Curated description.');
    expect(out).not.toContain('Raw <title>');
  });

  it('de-duplicates repeated page URLs', () => {
    const pages: ParsedHtml[] = [
      parsedPage('https://example.com/a', 'Page A'),
      parsedPage('https://example.com/a', 'Page A duplicate'),
    ];
    const out = renderLlmsFullTxt(manifest({ sections: [] }), pages);
    const occurrences = out.split('Source: https://example.com/a').length - 1;
    expect(occurrences).toBe(1);
  });
});
