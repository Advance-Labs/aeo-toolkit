import { describe, expect, it } from 'vitest';
import { validateItem } from './validation.js';

describe('validateItem', () => {
  it('validates an Article with a headline', () => {
    const r = validateItem('Article', { headline: 'Hello' });
    expect(r.valid).toBe(true);
    expect(r.missingRequired).toEqual([]);
  });

  it('reports a missing Article headline', () => {
    const r = validateItem('Article', { author: 'Jane' });
    expect(r.valid).toBe(false);
    expect(r.missingRequired).toEqual(['headline']);
  });

  it('requires a HowTo to declare steps', () => {
    expect(validateItem('HowTo', {}).missingRequired).toContain('step');
    expect(validateItem('HowTo', { step: [{ '@type': 'HowToStep', text: 'Do it' }] }).valid).toBe(
      true,
    );
  });

  it('requires BreadcrumbList itemListElement', () => {
    expect(validateItem('BreadcrumbList', {}).valid).toBe(false);
    expect(
      validateItem('BreadcrumbList', { itemListElement: [{ '@type': 'ListItem', name: 'Home' }] })
        .valid,
    ).toBe(true);
  });

  it('validates a QAPage mainEntity Question with an acceptedAnswer', () => {
    const valid = validateItem('QAPage', {
      mainEntity: { '@type': 'Question', name: 'Q?', acceptedAnswer: { text: 'A' } },
    });
    expect(valid.valid).toBe(true);

    const invalid = validateItem('QAPage', {
      mainEntity: { '@type': 'Question', name: 'Q?' },
    });
    expect(invalid.valid).toBe(false);
    expect(invalid.missingRequired).toContain('mainEntity.acceptedAnswer');
  });

  it('warns when LocalBusiness address is a plain string', () => {
    const r = validateItem('LocalBusiness', { name: 'Cafe', address: '1 Main St' });
    expect(r.valid).toBe(true);
    expect(r.warnings.join(' ')).toMatch(/PostalAddress/);
  });

  it('treats an unknown type as valid (no rule to assert)', () => {
    const r = validateItem('SoftwareApplication', { name: 'App' });
    expect(r.valid).toBe(true);
    expect(r.missingRequired).toEqual([]);
  });

  it('applies the union of rules for a multi-type item', () => {
    const r = validateItem('Product,Review', { name: 'X' });
    expect(r.valid).toBe(false);
    expect(r.missingRequired).toContain('reviewRating');
    expect(r.missingRequired).not.toContain('name');
  });

  it('reads required properties case-insensitively', () => {
    const r = validateItem('Person', { Name: 'Jane' });
    expect(r.valid).toBe(true);
  });
});
