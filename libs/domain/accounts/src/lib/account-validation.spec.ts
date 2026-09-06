import { validateAccountSubmission } from './account-validation.js';
import type { AccountSubmission } from './account-validation.js';

/**
 * Exercises every rule in data-model.md's "Validation rules" section
 * (FR-006-FR-010): required non-empty-after-trim name, category whitelist
 * with `OTHER` default, and trim/null-normalization of every optional field.
 */

const validSubmission: AccountSubmission = {
  name: 'N26 checking',
  category: 'GENERAL',
  provider: 'N26',
  website: 'https://n26.com',
  purpose: 'Everyday spending',
  cardUsage: 'Contactless only',
  requiredMinimum: '€500',
  notes: 'Shared with partner',
};

describe('validateAccountSubmission — name', () => {
  it('accepts a valid submission', () => {
    const result = validateAccountSubmission(validSubmission);
    expect(result.valid).toBe(true);
  });

  it('rejects a blank name', () => {
    const result = validateAccountSubmission({ ...validSubmission, name: '' });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.fieldErrors).toContainEqual(expect.objectContaining({ field: 'name' }));
    }
  });

  it('rejects a whitespace-only name', () => {
    const result = validateAccountSubmission({ ...validSubmission, name: '   ' });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.fieldErrors).toContainEqual(expect.objectContaining({ field: 'name' }));
    }
  });

  it('trims the name on success', () => {
    const result = validateAccountSubmission({ ...validSubmission, name: '  Savings  ' });
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.value.name).toBe('Savings');
    }
  });
});

describe('validateAccountSubmission — category', () => {
  it('defaults missing category to OTHER', () => {
    const { category: _category, ...withoutCategory } = validSubmission;
    const result = validateAccountSubmission(withoutCategory);
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.value.category).toBe('OTHER');
    }
  });

  it('accepts every known category literal', () => {
    for (const category of ['GENERAL', 'LEISURE', 'SAVINGS', 'CREDIT_CARD', 'OTHER'] as const) {
      const result = validateAccountSubmission({ ...validSubmission, category });
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.value.category).toBe(category);
      }
    }
  });

  it('rejects an unknown category literal', () => {
    const result = validateAccountSubmission({
      ...validSubmission,
      category: 'CRYPTO' as AccountSubmission['category'],
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.fieldErrors).toContainEqual(expect.objectContaining({ field: 'category' }));
    }
  });
});

describe('validateAccountSubmission — optional field trimming/null-normalization', () => {
  it('trims every optional field', () => {
    const result = validateAccountSubmission({
      ...validSubmission,
      provider: '  N26  ',
      website: '  https://n26.com  ',
      purpose: '  Everyday spending  ',
      cardUsage: '  Contactless only  ',
      requiredMinimum: '  €500  ',
      notes: '  Shared with partner  ',
    });
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.value.provider).toBe('N26');
      expect(result.value.website).toBe('https://n26.com');
      expect(result.value.purpose).toBe('Everyday spending');
      expect(result.value.cardUsage).toBe('Contactless only');
      expect(result.value.requiredMinimum).toBe('€500');
      expect(result.value.notes).toBe('Shared with partner');
    }
  });

  it('normalizes an empty-after-trim optional field to null', () => {
    const result = validateAccountSubmission({
      ...validSubmission,
      provider: '   ',
      website: '',
    });
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.value.provider).toBeNull();
      expect(result.value.website).toBeNull();
    }
  });

  it('leaves omitted optional fields as null', () => {
    const result = validateAccountSubmission({ name: 'Minimal account' });
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.value.provider).toBeNull();
      expect(result.value.website).toBeNull();
      expect(result.value.purpose).toBeNull();
      expect(result.value.cardUsage).toBeNull();
      expect(result.value.requiredMinimum).toBeNull();
      expect(result.value.notes).toBeNull();
      expect(result.value.category).toBe('OTHER');
    }
  });
});
