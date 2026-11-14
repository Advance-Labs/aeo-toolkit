# Static HTML

Add to the `<head>` (or end of `<body>`) of the homepage and each location page:

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Plumber",
  "name": "Example Plumbing",
  "url": "https://example.com/",
  "telephone": "+15195550100",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "123 Main St",
    "addressLocality": "Guelph",
    "addressRegion": "ON",
    "postalCode": "N1H 1A1",
    "addressCountry": "CA"
  },
  "geo": { "@type": "GeoCoordinates", "latitude": 43.54481, "longitude": -80.24817 },
  "openingHoursSpecification": [
    { "@type": "OpeningHoursSpecification",
      "dayOfWeek": ["Monday","Tuesday","Wednesday","Thursday","Friday"],
      "opens": "08:00", "closes": "17:00" }
  ],
  "areaServed": ["Guelph", "Cambridge"]
}
</script>
```

All values are placeholders: replace with the confirmed details. Service-area business with a
hidden address: omit `streetAddress` only if the owner agrees and keep `addressLocality` and
`addressRegion`; Google requires `address`, so give as much as the owner is willing to publish.
Remember to update the block whenever hours change.
