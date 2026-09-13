import { describe, expect, it } from 'vitest';
import { analyzeStructuredData } from './analyze.js';

const URL = 'https://example.com/page';

/** JSON-LD FAQPage with two valid Question/acceptedAnswer pairs. */
const FAQ_JSON_LD = `
<!doctype html>
<html><head>
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "What is AEO?",
      "acceptedAnswer": { "@type": "Answer", "text": "Answer engine optimization." }
    },
    {
      "@type": "Question",
      "name": "Why does it matter?",
      "acceptedAnswer": { "@type": "Answer", "text": "It drives AI citations." }
    }
  ]
}
</script>
</head><body><h1>FAQ</h1></body></html>
`;

/** Microdata Product with name + offer. */
const PRODUCT_MICRODATA = `
<!doctype html>
<html><body>
<div itemscope itemtype="https://schema.org/Product">
  <span itemprop="name">Acme Widget</span>
  <div itemprop="offers" itemscope itemtype="https://schema.org/Offer">
    <meta itemprop="price" content="19.99" />
    <link itemprop="availability" href="https://schema.org/InStock" />
  </div>
</div>
</body></html>
`;

/** RDFa Person with a name. */
const PERSON_RDFA = `
<!doctype html>
<html><body>
<div vocab="https://schema.org/" typeof="Person">
  <span property="name">Jane Doe</span>
  <span property="jobTitle">Engineer</span>
</div>
</body></html>
`;

describe('analyzeStructuredData', () => {
  it('detects and validates a JSON-LD FAQPage', () => {
    const report = analyzeStructuredData(FAQ_JSON_LD, URL);

    expect(report.totalItems).toBe(1);
    expect(report.typesPresent).toContain('FAQPage');
    expect(report.aeoTypesPresent).toContain('FAQPage');
    expect(report.hasFaqOrQa).toBe(true);
    expect(report.invalidCount).toBe(0);

    const item = report.items[0];
    expect(item).toBeDefined();
    expect(item?.format).toBe('json-ld');
    expect(item?.valid).toBe(true);
    expect(item?.missingRequired).toEqual([]);
  });

  it('detects and validates Microdata Product', () => {
    const report = analyzeStructuredData(PRODUCT_MICRODATA, URL);

    expect(report.typesPresent).toContain('Product');
    expect(report.aeoTypesPresent).toContain('Product');
    const product = report.items.find((i) => i.type === 'Product');
    expect(product).toBeDefined();
    expect(product?.format).toBe('microdata');
    expect(product?.valid).toBe(true);
    expect(product?.properties['name']).toBe('Acme Widget');
    // Nested Offer captured as an object with its @type.
    const offers = product?.properties['offers'];
    expect(offers).toMatchObject({ '@type': 'Offer', price: '19.99' });
  });

  it('detects and validates RDFa Person', () => {
    const report = analyzeStructuredData(PERSON_RDFA, URL);

    expect(report.typesPresent).toContain('Person');
    expect(report.aeoTypesPresent).toContain('Person');
    expect(report.hasPerson).toBe(true);
    const person = report.items.find((i) => i.type === 'Person');
    expect(person?.format).toBe('rdfa');
    expect(person?.valid).toBe(true);
    expect(person?.properties['name']).toBe('Jane Doe');
  });

  it('aggregates multiple formats in one document and counts invalid items', () => {
    const invalidArticle = `
      <script type="application/ld+json">
      {"@context":"https://schema.org","@type":"Article"}
      </script>`;
    const html = `<html><head>${invalidArticle}</head><body>
      ${PRODUCT_MICRODATA}${PERSON_RDFA}</body></html>`;

    const report = analyzeStructuredData(html, URL);
    expect(report.totalItems).toBe(3);
    expect(report.hasArticle).toBe(true);
    expect(report.hasPerson).toBe(true);
    expect(report.invalidCount).toBe(1); // Article missing headline
  });

  it('returns an empty report for HTML with no structured data', () => {
    const report = analyzeStructuredData('<html><body><p>plain</p></body></html>', URL);
    expect(report.totalItems).toBe(0);
    expect(report.typesPresent).toEqual([]);
    expect(report.aeoTypesPresent).toEqual([]);
    expect(report.hasOrganization).toBe(false);
    expect(report.invalidCount).toBe(0);
  });

  it('marks LocalBusiness as satisfying the Organization presence flag', () => {
    const html = `
      <script type="application/ld+json">
      {"@context":"https://schema.org","@type":"LocalBusiness",
       "name":"Joe's Cafe","address":{"@type":"PostalAddress","streetAddress":"1 Main St"}}
      </script>`;
    const report = analyzeStructuredData(html, URL);
    expect(report.hasOrganization).toBe(true);
    expect(report.aeoTypesPresent).toContain('LocalBusiness');
    const item = report.items[0];
    expect(item?.valid).toBe(true);
  });
});

describe('nested @type collection (ADV-173)', () => {
  it('sees a Person nested as a property, not only top-level nodes', () => {
    const html = `<script type="application/ld+json">${JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'Organization',
          name: 'Advance Labs Inc.',
          founder: [
            { '@type': 'Person', name: 'Lucas Krawczak' },
            { '@type': 'Person', name: 'Matthew Krawczak' },
          ],
          address: { '@type': 'PostalAddress', addressLocality: 'London' },
        },
        { '@type': 'WebSite', name: 'Advance Labs' },
      ],
    })}</script>`;
    const r = analyzeStructuredData(html, 'https://example.com/');
    expect(r.hasPerson).toBe(true);
    expect(r.hasOrganization).toBe(true);
    expect(r.typesPresent).toEqual(
      expect.arrayContaining(['Organization', 'WebSite', 'Person', 'PostalAddress']),
    );
    // `items` keeps its top-level meaning: two published nodes, not five.
    expect(r.totalItems).toBe(2);
  });

  it('sees an Article author nested the way Google documents it', () => {
    const html = `<script type="application/ld+json">${JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: 'A post',
      author: { '@type': 'Person', name: 'Lucas Krawczak' },
    })}</script>`;
    const r = analyzeStructuredData(html, 'https://example.com/post');
    expect(r.hasArticle).toBe(true);
    expect(r.hasPerson).toBe(true);
  });

  it('handles an array-valued nested @type', () => {
    const html = `<script type="application/ld+json">${JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      mainEntity: { '@type': ['FAQPage', 'CreativeWork'], name: 'FAQ' },
    })}</script>`;
    const r = analyzeStructuredData(html, 'https://example.com/');
    expect(r.hasFaqOrQa).toBe(true);
  });

  it('still works for flat, non-graph documents', () => {
    const html = `<script type="application/ld+json">${JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Home' }],
    })}</script>`;
    const r = analyzeStructuredData(html, 'https://example.com/');
    expect(r.hasBreadcrumb).toBe(true);
    expect(r.typesPresent).toEqual(expect.arrayContaining(['BreadcrumbList', 'ListItem']));
  });
});
