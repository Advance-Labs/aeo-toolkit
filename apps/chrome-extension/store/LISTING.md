# Listing copy, v0.3.0

**Name:** AEO/GEO Auditor

**Category:** Developer Tools  **Language:** English

**Short description** (manifest `description`, 127 chars):
Client-side AEO/GEO audit of the active tab: meta, structured data, robots.txt, sitemap, llms.txt, AI-bot rules. Exports a PDF.

**Full description:** unchanged from `CHROME_STORE.md` section 4, except the check count. This
build runs 44 rules (31 technical SEO + 13 AEO); rules that do not apply to a page are dropped,
so a single audit shows up to 44 results (42 on advancelabs.dev). Replace "40 checks" with
"44 checks" in the opening paragraph. 9 categories is unchanged. Do not use the paid audit's
figure.

**What's new in 0.3.0:**
A redesigned popup: light concrete look, clearer score and grade, pass and fail marks that read
at a glance, and a more compact layout that fits the popup without scrolling. New icons. The
audit rules, permissions and data handling are unchanged.

**Permissions:** unchanged (`activeTab`, `scripting`, `<all_urls>` host access for the audited
site's own robots.txt, sitemap.xml and llms.txt). Privacy policy: https://advancelabs.dev/privacy/aeo-auditor
