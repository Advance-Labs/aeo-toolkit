/** Shared HTML fixtures for tests. Not part of the public API (not re-exported by index). */

/**
 * A content-rich page: full meta + OG + Twitter, valid heading tree with a
 * question and an FAQ heading, images (some missing alt), internal + external
 * links (one nofollow), an FAQPage JSON-LD block, plus microdata and RDFa.
 */
export const RICH_PAGE_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Best Espresso Machines — Buyer's Guide</title>
    <meta name="description" content="An in-depth, independent guide to choosing the best home espresso machine in 2026." />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="index, follow" />
    <meta name="theme-color" content="#6f4e37" />
    <link rel="canonical" href="https://shop.example.com/guides/espresso" />

    <meta property="og:title" content="Best Espresso Machines" />
    <meta property="og:description" content="Independent buyer's guide for 2026." />
    <meta property="og:image" content="/images/og-espresso.jpg" />
    <meta property="og:url" content="https://shop.example.com/guides/espresso" />
    <meta property="og:type" content="article" />
    <meta property="og:site_name" content="Example Shop" />

    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="Best Espresso Machines" />
    <meta name="twitter:description" content="Independent buyer's guide for 2026." />
    <meta name="twitter:image" content="/images/tw-espresso.jpg" />
    <meta name="twitter:site" content="@exampleshop" />

    <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": [
          {
            "@type": "Question",
            "name": "How much should I spend?",
            "acceptedAnswer": { "@type": "Answer", "text": "Between $300 and $800 for home use." }
          }
        ]
      }
    </script>
  </head>
  <body>
    <h1>Best Espresso Machines</h1>
    <h2>How do espresso machines work?</h2>
    <p>Espresso machines force hot water through finely-ground coffee under pressure.</p>
    <p>Most home machines target nine bars of pressure for a balanced shot.</p>
    <h3>Pump versus lever</h3>
    <p>Pump machines are easier for beginners.</p>
    <h2>Frequently Asked Questions</h2>
    <ul>
      <li>Pick a budget</li>
      <li>Choose a roast</li>
    </ul>
    <table><tr><td>Model</td><td>Price</td></tr></table>

    <img src="/images/machine-1.jpg" alt="A stainless steel espresso machine" width="640" height="480" />
    <img src="/images/machine-2.jpg" />

    <a href="/guides/grinders">Our grinder guide</a>
    <a href="https://external.example.org/review" rel="nofollow noopener">External review</a>
    <a href="#top">Back to top</a>

    <div itemscope itemtype="https://schema.org/Product">
      <span itemprop="name">Example Machine</span>
    </div>
    <div typeof="schema:Organization" vocab="https://schema.org/">
      <span property="name">Example Shop</span>
    </div>
  </body>
</html>`;

/**
 * A sparse page: bare HTML with no meta description, no OG/Twitter, a single
 * heading that skips from h1 to h3, one alt-less image, no structured data.
 */
export const SPARSE_PAGE_HTML = `<!doctype html>
<html>
  <head>
    <title>Untitled</title>
  </head>
  <body>
    <h1>Welcome</h1>
    <h3>Sub-section</h3>
    <p>Hello.</p>
    <img src="logo.png" alt="" />
    <a href="javascript:void(0)">Do nothing</a>
  </body>
</html>`;

/** Base URL the fixtures are served from, used for link/image resolution. */
export const FIXTURE_URL = 'https://shop.example.com/guides/espresso';
