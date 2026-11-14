---
name: aeo-local-business-schema
description: Add or fix LocalBusiness structured data and keep name, address and phone (NAP) consistent across a site, Google Business Profile and directories, so local searchers and AI answer engines get the right facts. Use when someone asks about "local SEO schema", "LocalBusiness JSON-LD", "opening hours markup", "NAP consistency", "service area", "show up for plumber near me in ChatGPT", or wrong hours or address appearing in answers. Works for WordPress and static HTML. Uses the aeo-visibility MCP server (analyze_website_aeo, check_ai_visibility) if connected.
---

# LocalBusiness schema and NAP consistency

For a business with a physical location or service area, the facts that matter are name,
address, phone, hours, and where it serves. This skill puts those facts in markup and makes them
agree everywhere they appear.

**Note:** the scoring engine has no local-business rule yet. `analyze_website_aeo` will not fail
a site for missing LocalBusiness markup. Detection uses its structured-data findings plus manual
inspection.

## When this matters / when it doesn't

Matters for businesses customers visit or that travel to customers (trades, clinics, restaurants,
shops).

Does not apply, or needs care, when:
- The business is online-only with no location or service area. Use Organization markup
  (`aeo-organization-entity`), not LocalBusiness.
- The owner does not want the address public (home-based service business). Google Business
  Profile guidance is that service-area businesses "should hide your business address". Do not put
  a home address in markup either. Ask.
- Reviews are the goal. Self-reviews do not earn stars (see Pitfalls).

Markup is not what makes a business appear in local results. Google says local results rely
mainly on relevance, distance and prominence, and that "there's no way to request or pay for a
better local ranking". Do the work because accurate facts help users and engines, not as a
ranking lever.

## Detect

1. `analyze_website_aeo` on the homepage and contact page; read structured-data findings.
2. View source for `ld+json`. Look for a LocalBusiness (or subtype) node, `address`,
   `telephone`, `openingHoursSpecification`.
3. Collect the business's name, address and phone from: the site footer, the contact page, the
   schema, Google Business Profile, and two or three directories. Put them in a table and
   compare character by character (suite numbers, "St" vs "Street", phone format, business name
   variants).
4. Ask the owner which version is true. Never decide this yourself.

## Decide

- **Subtype:** Google says use "the most specific LocalBusiness sub-type possible". schema.org
  has many (Store, Dentist, LegalService, FoodEstablishment, HomeAndConstructionBusiness,
  MedicalBusiness and others). For several types, use an array in `@type`; Google notes
  `additionalType` isn't supported.
- **Storefront or service area?** Storefront: show the address. Service-area business: hide the
  address in Business Profile, and describe the area in text and with `areaServed`. Note that
  Google's LocalBusiness property tables do not list `areaServed`; it is valid schema.org, so it
  is harmless and helps other consumers, but do not expect a Google feature from it.
- **Multiple locations:** one node per location, each with its own page, phone and hours.
- **Departments:** nest as `department`, named `{store name} {department name}` unless the
  department has its own brand.

Google's properties:

| | Properties |
|---|---|
| Required | `name`, `address` (PostalAddress, as complete as possible) |
| Recommended | `telephone` (with country and area code, e.g. +12122459600), `url`, `geo` (latitude and longitude with at least 5 decimal places), `openingHoursSpecification`, `priceRange` (under 100 characters), `department`; `aggregateRating`/`review` only for sites that capture reviews of *other* local businesses |

## Implement

1. One LocalBusiness JSON-LD block on the homepage or contact page (and each location page).
   Use the same string for `name` as on the storefront and the Business Profile.
2. Hours, per Google's format:
   ```json
   "openingHoursSpecification": [
     { "@type": "OpeningHoursSpecification",
       "dayOfWeek": ["Monday","Tuesday","Wednesday","Thursday","Friday"],
       "opens": "09:00", "closes": "17:00" }
   ]
   ```
   Omit `validFrom` and `validThrough` for year-round hours. Closing past midnight: one spec, for
   example `opens: "18:00"`, `closes: "03:00"`. Closed all day: `00:00` and `00:00`. Seasonal
   closure: `00:00`/`00:00` with `validFrom` and `validThrough` in YYYY-MM-DD.
3. Put the same NAP in visible HTML (footer or contact page). Markup must describe visible
   content.
4. **Google Business Profile.** Claim and verify it; this is separate from your site and drives
   the map listing. Rules from Google's guidelines: the name "should reflect your business's
   real-world name, as used consistently on your storefront, website, stationery"; no keywords,
   taglines, or phone numbers in the name; a precise address, no P.O. boxes or virtual offices;
   service-area businesses may have one profile with a service area (not much beyond about two
   hours' drive) and should hide a home address; use a local phone number and the
   location-specific website URL; choose few, specific categories. Keep hours, including holiday
   hours, current. Respond to reviews.
5. **Directories.** Update the main ones to the confirmed NAP. Google lists prominence factors
   as including links and reviews; it does not publish a "citations" rule, so do not claim that
   directory listings are a ranking factor. Consistent real-world facts are the goal.

Stack specifics: `references/wordpress.md`, `references/static-html.md`.

## Verify

- Rich Results Test and validator.schema.org: no errors; warnings reviewed.
- Rendered hours and phone in the markup equal the visible page and the Business Profile.
- Run `check_ai_visibility` with **location-specific prompts** written like a customer, for
  example "emergency plumber in Guelph Ontario" or "best dentist near Westboro Ottawa". The
  tool has no location parameter; the place name must be inside the prompt. It queries
  Perplexity Sonar only and needs a Perplexity key. Each run is one sample, so repeat prompts,
  record which sources are cited, and compare before and after rather than claiming a cause.
  Use `compare_competitor_visibility` with the business and two or three local rivals to see who
  is cited.
- Search a few prompts yourself and read whether the engine states the right hours and address.
  Wrong facts there usually trace to an outdated directory, not the site.

## Pitfalls

- Name variants ("Smith Plumbing", "Smith Plumbing Ltd.", "Smith Plumbing Guelph") across
  sources.
- Stuffing keywords or the city into the business name; it can get the Business Profile suspended.
- Markup for a location the business does not staff.
- Hours in markup that ignore holidays or differ from the profile.
- Self-serving reviews: if the business controls the reviews about itself, its
  `LocalBusiness`/`Organization` pages are ineligible for star results, including via an
  embedded third-party widget. Do not add `aggregateRating` to your own business node.
- A home address published against the owner's wishes.
- Several LocalBusiness nodes on one page that conflict.

## Sources

- Local business structured data: https://developers.google.com/search/docs/appearance/structured-data/local-business (verified 2026-11-13)
- Review snippet (self-serving reviews): https://developers.google.com/search/docs/appearance/structured-data/review-snippet (verified 2026-11-13)
- Business Profile guidelines: https://support.google.com/business/answer/3038177 (verified 2026-11-13)
- Tips to improve local ranking: https://support.google.com/business/answer/7091 (verified 2026-11-13)
- schema.org LocalBusiness: https://schema.org/LocalBusiness ; areaServed: https://schema.org/areaServed ; OpeningHoursSpecification: https://schema.org/OpeningHoursSpecification (verified 2026-11-13)
