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
