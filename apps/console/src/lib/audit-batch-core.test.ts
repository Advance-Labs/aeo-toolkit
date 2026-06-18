import { describe, expect, it } from "vitest";
// The batch runner's pure helpers live next to the runnable script (plain .mjs so `node` can run
// the script directly). We test them here because vitest only discovers `src/**/*.test.ts`.
import {
  CSV_COLUMNS,
  normalizeUrl,
  parseTargets,
  slugify,
  summaryRow,
  toCsv,
  topFix,
} from "../../scripts/lib/batch-core.mjs";

describe("normalizeUrl", () => {
  it("adds https:// when no scheme is present", () => {
    expect(normalizeUrl("example.com")).toBe("https://example.com");
  });

  it("lowercases the host and strips a trailing slash", () => {
    expect(normalizeUrl("https://Example.COM/")).toBe("https://example.com");
  });

  it("keeps a non-root path (trailing slash trimmed)", () => {
    expect(normalizeUrl("example.com/services/")).toBe("https://example.com/services");
  });

  it("strips surrounding quotes", () => {
    expect(normalizeUrl('"example.com"')).toBe("https://example.com");
  });

  it("rejects comments, blanks, and hostnames without a dot", () => {
    expect(normalizeUrl("# a comment")).toBeNull();
    expect(normalizeUrl("   ")).toBeNull();
    expect(normalizeUrl("localhost")).toBeNull();
    expect(normalizeUrl(null)).toBeNull();
  });
});

describe("parseTargets", () => {
  it("parses a plain list, ignoring comments and blank lines", () => {
    const text = `# London SMBs\n\nexample.com\nhttps://foo.ca/\n  bar.com  \n`;
    expect(parseTargets(text)).toEqual([
      "https://example.com",
      "https://foo.ca",
      "https://bar.com",
    ]);
  });

  it("de-duplicates after normalization", () => {
    const text = `Example.com\nexample.com/\nhttps://example.com`;
    expect(parseTargets(text)).toEqual(["https://example.com"]);
  });

  it("reads a CSV with a url/domain header column", () => {
    const text = `name,website,city\nAcme HVAC,acme-hvac.ca,London\nBeta Dental,https://beta.dental,London`;
    expect(parseTargets(text)).toEqual([
      "https://acme-hvac.ca",
      "https://beta.dental",
    ]);
  });

  it("falls back to the first column for headerless CSV rows", () => {
    const text = `acme.com,London\nbeta.ca,Toronto`;
    expect(parseTargets(text)).toEqual(["https://acme.com", "https://beta.ca"]);
  });
});

describe("slugify", () => {
  it("drops the scheme and www, hyphenates the rest", () => {
    expect(slugify("https://www.Acme-HVAC.ca/services")).toBe("acme-hvac-ca-services");
  });

  it("never returns an empty slug", () => {
    expect(slugify("https://")).toBe("site");
  });
});

describe("topFix / summaryRow", () => {
  const report = {
    url: "https://acme.ca",
    pagesCrawled: 8,
    score: { overall: 54, grade: "F", failedCount: 9, criticalCount: 2 },
    topFixes: [
      { id: "x", severity: "medium", weight: 5, title: "Med fix" },
      { id: "y", severity: "critical", weight: 3, title: "Crit fix" },
      { id: "z", severity: "critical", weight: 9, title: "Big crit fix" },
    ],
  };

  it("picks the highest-severity, highest-weight fix", () => {
    expect(topFix(report)).toMatchObject({ id: "z", title: "Big crit fix" });
  });

  it("builds a complete summary row", () => {
    expect(summaryRow("https://acme.ca", report)).toEqual({
      url: "https://acme.ca",
      score: 54,
      grade: "F",
      pages: 8,
      failed: 9,
      critical: 2,
      topFix: "[critical] Big crit fix",
    });
  });

  it("degrades gracefully on an empty report", () => {
    expect(summaryRow("https://x.com", {})).toEqual({
      url: "https://x.com",
      score: "",
      grade: "",
      pages: "",
      failed: "",
      critical: "",
      topFix: "",
    });
  });
});

describe("toCsv", () => {
  it("always emits a header, even with no rows", () => {
    expect(toCsv([])).toBe(`${CSV_COLUMNS.join(",")}\n`);
  });

  it("quotes cells containing commas or quotes", () => {
    const csv = toCsv([
      { url: "https://a.com", score: 40, grade: "F", pages: 3, failed: 5, critical: 1, topFix: 'A, "big" fix' },
    ]);
    expect(csv).toContain(`"A, ""big"" fix"`);
    expect(csv.split("\n")[0]).toBe(CSV_COLUMNS.join(","));
  });
});
