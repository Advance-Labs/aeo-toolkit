/**
 * Invariants for the content modules behind /glossary and /compare. These pages are the
 * definitional-citation surface, so the tests enforce the properties that make them citable:
 * liftable answer-first definitions, resolvable interlinks, and metadata within limits.
 */
import { describe, expect, it } from 'vitest';
import { COMPARISONS } from './compare';
import { GLOSSARY_TERMS, glossaryTerm } from './glossary';

/** Internal routes the content is allowed to link to (checked against tool/related hrefs). */
const KNOWN_INTERNAL_PREFIXES = ['/tools/', '/glossary', '/guide/', '/compare/', '/mcp'];

describe('glossary content', () => {
  it('has unique, kebab-case slugs', () => {
    const slugs = GLOSSARY_TERMS.map((t) => t.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it.each(GLOSSARY_TERMS.map((t) => [t.slug, t] as const))(
    '%s: answer-first definition is liftable (self-contained, 1–2 sentences of real length)',
    (_slug, term) => {
      // Long enough to be an answer, short enough to be quoted whole.
      expect(term.definition.length).toBeGreaterThan(120);
      expect(term.definition.length).toBeLessThan(600);
      // Self-contained: defines the term by name rather than opening with a dangling pronoun.
      expect(term.definition.toLowerCase()).not.toMatch(/^(it|this|that|they)\b/);
    },
  );

  it.each(GLOSSARY_TERMS.map((t) => [t.slug, t] as const))(
    '%s: related slugs resolve and never self-reference',
    (_slug, term) => {
      for (const related of term.related) {
        expect(related).not.toBe(term.slug);
        expect(glossaryTerm(related), `related slug "${related}" must exist`).toBeDefined();
      }
    },
  );

  it.each(GLOSSARY_TERMS.map((t) => [t.slug, t] as const))(
    '%s: meta description fits the snippet window and tool links stay internal',
    (_slug, term) => {
      expect(term.metaDescription.length).toBeGreaterThan(70);
      expect(term.metaDescription.length).toBeLessThanOrEqual(160);
      for (const tool of term.tools) {
        expect(
          KNOWN_INTERNAL_PREFIXES.some((prefix) => tool.href.startsWith(prefix)),
          `tool href "${tool.href}" must be an internal route`,
        ).toBe(true);
      }
    },
  );
});

describe('comparison content', () => {
  it('has unique slugs and well-formed tables', () => {
    const slugs = COMPARISONS.map((c) => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const entry of COMPARISONS) {
      expect(entry.rows.length).toBeGreaterThanOrEqual(4);
      expect(entry.title).toContain(' vs ');
      expect(entry.faq.length).toBeGreaterThan(0);
      expect(entry.metaDescription.length).toBeLessThanOrEqual(160);
    }
  });

  it('verdicts are liftable and related links resolve to internal routes', () => {
    for (const entry of COMPARISONS) {
      expect(entry.verdict.length).toBeGreaterThan(120);
      for (const link of entry.related) {
        expect(
          KNOWN_INTERNAL_PREFIXES.some((prefix) => link.href.startsWith(prefix)),
          `related href "${link.href}" must be an internal route`,
        ).toBe(true);
        if (link.href.startsWith('/glossary/')) {
          expect(glossaryTerm(link.href.slice('/glossary/'.length))).toBeDefined();
        }
      }
    }
  });
});
