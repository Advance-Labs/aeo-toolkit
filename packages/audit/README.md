# @advance-labs/audit

One-command AEO and SEO audit for the terminal. It crawls a site, runs the AEO Toolkit rule set, and prints a score, per-category scores and the top fixes.

```bash
npx @advance-labs/audit example.com
```

Needs Node 20 or newer. No install, no account, no API key.

## Usage

```bash
npx @advance-labs/audit <url-or-domain> [--pages N] [--json] [--fail-under SCORE]
```

| Flag | Meaning |
|------|---------|
| `--pages <n>` | Pages to crawl. Default 10, max 50. |
| `--json` | Print the full machine-readable report (the `AuditReport` from `@advance-labs/types`) instead of the summary. |
| `--fail-under <score>` | Exit with code 1 if the overall score is below `<score>` (0 to 100). For CI. |
| `-h`, `--help` | Show help. |

Exit codes: `0` ok, `1` score below `--fail-under`, `2` usage error or the site could not be fetched.

CI example:

```bash
npx @advance-labs/audit https://staging.example.com --pages 20 --fail-under 80
```

## Example output

`npx @advance-labs/audit https://www.iana.org --pages 3`

```text
AEO/SEO audit: https://www.iana.org/
3 pages crawled

Overall score: 65/100 (grade D)
26 checks passed, 16 failed, 4 critical

Categories
  Crawlability               #######...  74/100
  Indexing                   ########## 100/100
  Metadata                   #######...  69/100
  Content                    #######...  69/100
  Structured Data            ####......  40/100
  Social                     ..........   0/100
  Mobile                     ########## 100/100
  Security                   ########## 100/100
  Answer Engine Optimization ####......  43/100

Top 5 fixes
  1. [high] FAQ or QA schema is present
     Fix: Mark up your FAQ section with FAQPage JSON-LD.
  2. [high] XML sitemap is present
     Fix: Publish a sitemap.xml and reference it from robots.txt.
  3. [high] Content uses question-shaped headings
     Fix: Add headings like "How does X work?" above their answers.
  4. [high] Structured data is present
     Fix: Add JSON-LD structured data describing the page.
  5. [medium] Content is answerable (sufficient depth + lists)
     Fix: Aim for 300+ words and use lists for key facts.

Full report with fix templates: https://advancelabs.dev/tools/audit?utm_source=npm&utm_medium=cli
```

## What it does and does not do

- Crawls politely with [`@advance-labs/crawler`](../crawler): robots.txt respected, sitemap first, per-host rate limit, bounded page count.
- Refuses private, loopback, link-local and cloud-metadata addresses on every request and redirect hop, using [`@advance-labs/net-guard`](../net-guard).
- Scores with the same rules as the Chrome extension, from [`@advance-labs/scoring`](../scoring).
- Makes no network calls except the crawl of the site you name. No telemetry.
- The summary links to the free web tool for the full report with fix templates. The web tool does not take a URL in the link yet, so the link is generic.

## Related

- Free web audit: <https://advancelabs.dev/tools/audit>
- Library packages: [`scoring`](../scoring), [`crawler`](../crawler), [`html-parser`](../html-parser), [`schema-validator`](../schema-validator), [`net-guard`](../net-guard), [`types`](../types)
- Docs: <https://advancelabs.dev/docs/aeo-toolkit>

## License

Apache-2.0
