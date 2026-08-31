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
    // The script tag is required: see the script-presence test below. A shell with no
    // script alongside it is a widget mount on a server-rendered page, not an SPA.
    const signals = computeContentSignals(
      '<html><body><div id="app">\n   \n</div><script src="a.js"></script></body></html>',
    );
    expect(signals.hasEmptyAppShell).toBe(true);
  });

  it('recognises the other common mount-point conventions', () => {
    for (const shell of ['<div id="app"></div>', '<div data-reactroot=""></div>']) {
      expect(
        computeContentSignals(
          `<html><body>${shell}<script src="a.js"></script></body></html>`,
        ).hasEmptyAppShell,
        `shell: ${shell}`,
      ).toBe(true);
    }
  });

  it('counts every script element', () => {
    const signals = computeContentSignals(
      '<html><head><script>a()</script></head><body><script>b()</script><script src="c.js"></script></body></html>',
    );
    expect(signals.scriptCount).toBe(3);
  });
});

describe('client-render detection — defects found in adversarial review', () => {
  it('does NOT flag a short server-rendered page carrying an unrelated empty mount div', () => {
    // FALSE POSITIVE found in review: a contact page with a widget-mount div and no
    // scripts is simply a short page. Reporting it as invisible to crawlers is the same
    // class of misdiagnosis this rule exists to prevent, pointed the other way.
    const signals = computeContentSignals(
      '<html><body><h1>Contact</h1><p>Call 555 1234.</p><div id="app"></div></body></html>',
    );
    expect(signals.hasEmptyAppShell).toBe(false);
  });

  it('flags a shell holding only a loading placeholder', () => {
    // FALSE NEGATIVE found in review, and the most common client-rendered page there is.
    // Exact emptiness was the wrong test.
    for (const placeholder of ['Loading...', 'Loading', ' ', 'Please wait']) {
      const signals = computeContentSignals(
        `<html><body><div id="root">${placeholder}</div><script src="a.js"></script></body></html>`,
      );
      expect(signals.hasEmptyAppShell, `placeholder: ${placeholder}`).toBe(true);
    }
  });

  it('does NOT treat a shell containing a real sentence as a placeholder', () => {
    // The other side of the placeholder allowance: server-rendered content inside the
    // mount point must still pass, or every SSR framework page gets flagged.
    const signals = computeContentSignals(
      '<html><body><div id="root"><p>This is genuine server rendered content.</p></div>' +
        '<script src="a.js"></script></body></html>',
    );
    expect(signals.hasEmptyAppShell).toBe(false);
  });

  it('recognises the mount points of the other common frameworks', () => {
    // FALSE NEGATIVES found in review: the original selector list covered React and Vue
    // conventions only.
    for (const id of ['___gatsby', 'q-app', '__nuxt', 'nuxt', 'svelte']) {
      const signals = computeContentSignals(
        `<html><body><div id="${id}"></div><script src="a.js"></script></body></html>`,
      );
      expect(signals.hasEmptyAppShell, `mount point: #${id}`).toBe(true);
    }
  });

  it('requires at least one script, since a real client-rendered page always ships one', () => {
    const noScript = computeContentSignals('<html><body><div id="root"></div></body></html>');
    expect(noScript.hasEmptyAppShell).toBe(false);

    const withScript = computeContentSignals(
      '<html><body><div id="root"></div><script src="a.js"></script></body></html>',
    );
    expect(withScript.hasEmptyAppShell).toBe(true);
  });
});
