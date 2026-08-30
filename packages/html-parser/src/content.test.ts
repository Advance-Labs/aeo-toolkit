import { describe, expect, it } from 'vitest';

import { computeContentSignals, isQuestionHeading } from './index.js';
import { RICH_PAGE_HTML, SPARSE_PAGE_HTML } from './fixtures.js';

describe('computeContentSignals', () => {
  it('derives word count, FAQ/HowTo, question headings, and structure counts on a rich page', () => {
    const signals = computeContentSignals(RICH_PAGE_HTML);
    expect(signals.wordCount).toBeGreaterThan(20);
    // FAQ via both the "Frequently Asked Questions" heading and the FAQPage JSON-LD.
    expect(signals.hasFaq).toBe(true);
    expect(signals.hasHowTo).toBe(false);
    // "How do espresso machines work?" is the one question heading.
    expect(signals.questionHeadingCount).toBe(1);
    expect(signals.paragraphCount).toBe(3);
    expect(signals.listCount).toBe(1);
    expect(signals.tableCount).toBe(1);
  });

  it('excludes script/style text from the word count', () => {
    const signals = computeContentSignals(
      '<html><body><style>.a{color:red}</style><script>var x=1</script><p>Two words.</p></body></html>',
    );
    expect(signals.wordCount).toBe(2);
  });

  it('reports minimal signals for a sparse page', () => {
    const signals = computeContentSignals(SPARSE_PAGE_HTML);
    expect(signals.hasFaq).toBe(false);
    expect(signals.hasHowTo).toBe(false);
    expect(signals.questionHeadingCount).toBe(0);
    expect(signals.listCount).toBe(0);
    expect(signals.tableCount).toBe(0);
  });

  it('detects HowTo via a JSON-LD block even without a how-to heading', () => {
    const html = `<html><body>
      <h2>Guide</h2>
      <script type="application/ld+json">{"@type":"HowTo","name":"Make coffee"}</script>
    </body></html>`;
    expect(computeContentSignals(html).hasHowTo).toBe(true);
  });
});

describe('isQuestionHeading', () => {
  it('recognizes a trailing question mark', () => {
    expect(isQuestionHeading('What is AEO?')).toBe(true);
  });

  it('recognizes a leading interrogative word without a question mark', () => {
    expect(isQuestionHeading('How espresso machines work')).toBe(true);
  });

  it('rejects a declarative heading', () => {
    expect(isQuestionHeading('Our grinder guide')).toBe(false);
  });
});

describe('client-side rendering signals', () => {
  it('flags an empty React root as an empty app shell', () => {
    const signals = computeContentSignals('<html><body><div id="root"></div><script src="/a.js"></script></body></html>');
    expect(signals.hasEmptyAppShell).toBe(true);
    expect(signals.scriptCount).toBe(1);
  });

  it('does NOT flag a filled mount point', () => {
    // A server-rendered Next page has #__next WITH content. The element is not the
    // signal; its emptiness is.
    const signals = computeContentSignals(
      '<html><body><div id="__next"><h1>Real heading</h1><p>Real body text here.</p></div></body></html>',
    );
    expect(signals.hasEmptyAppShell).toBe(false);
  });

  it('does not flag a page with no mount point at all', () => {
    const signals = computeContentSignals('<html><body><h1>Plain page</h1><p>Server rendered.</p></body></html>');
    expect(signals.hasEmptyAppShell).toBe(false);
  });

  it('treats a shell containing only scripts and noscript as empty', () => {
    // Non-visible nodes must not count as content, or the check is trivially defeated.
    const signals = computeContentSignals(
      '<html><body><div id="app"><noscript>Enable JavaScript</noscript><script>x()</script></div></body></html>',
    );
    expect(signals.hasEmptyAppShell).toBe(true);
  });

  it('treats a whitespace-only shell as empty', () => {
    const signals = computeContentSignals('<html><body><div id="app">\n   \n</div></body></html>');
    expect(signals.hasEmptyAppShell).toBe(true);
  });

  it('recognises the other common mount-point conventions', () => {
    for (const shell of ['<div id="app"></div>', '<div data-reactroot=""></div>']) {
      expect(computeContentSignals(`<html><body>${shell}</body></html>`).hasEmptyAppShell).toBe(true);
    }
  });

  it('counts every script element', () => {
    const signals = computeContentSignals(
      '<html><head><script>a()</script></head><body><script>b()</script><script src="c.js"></script></body></html>',
    );
    expect(signals.scriptCount).toBe(3);
  });
});
