import Decimal from 'decimal.js';
import { isValidIsin, validateHoldingSubmission } from './holding-validation.js';
import type { HoldingSubmission } from './holding-validation.js';

/**
 * Exercises every rule in data-model.md's "Validation rules" section
 * (FR-002–FR-010, Edge Cases). Written first per Principle III — confirmed
 * failing (no `holding-validation.ts` implementation yet) before T007.
 */

const validEtf: HoldingSubmission = {
  assetType: 'ETF',
  management: 'Roboadvisor',
  isin: 'IE00B4L5Y983',
  name: 'iShares Core MSCI World',
  quantity: '12.5',
  purchasePrice: '78.42',
};

const validShare: HoldingSubmission = {
  assetType: 'SHARE',
  management: 'Private',
  isin: 'US0378331005',
  name: 'Apple Inc.',
  quantity: '10',
  purchasePrice: '150.00',
};

const validGold: HoldingSubmission = {
  assetType: 'PRECIOUS_METAL',
  management: 'Private',
  name: 'Gold',
  weightGrams: '31.1',
};

const validBitcoin: HoldingSubmission = {
  assetType: 'CRYPTO',
  management: 'Private',
  name: 'Bitcoin',
  quantity: '0.25',
  purchasePrice: '42000.00',
};

describe('isValidIsin', () => {
  it('accepts well-formed ISINs with a correct check digit', () => {
    expect(isValidIsin('IE00B4L5Y983')).toBe(true);
    expect(isValidIsin('US0378331005')).toBe(true);
  });

  it('rejects an ISIN with an incorrect check digit', () => {
    expect(isValidIsin('US0378331006')).toBe(false);
  });

  it('rejects malformed ISINs (wrong length, lowercase, non-alphanumeric)', () => {
    expect(isValidIsin('US037833100')).toBe(false); // too short
    expect(isValidIsin('US03783310055')).toBe(false); // too long
    expect(isValidIsin('us0378331005')).toBe(false); // lowercase country code
    expect(isValidIsin('U50378331005')).toBe(false); // digit in country-code position
    expect(isValidIsin('US-378331005')).toBe(false); // non-alphanumeric
  });
});

describe('validateHoldingSubmission — universal rules', () => {
  it('accepts a valid submission of each asset type', () => {
    for (const submission of [validEtf, validShare, validGold, validBitcoin]) {
      const result = validateHoldingSubmission(submission);
      expect(result.valid).toBe(true);
    }
  });

  it('rejects an empty Management value for every asset type', () => {
    for (const submission of [validEtf, validShare, validGold, validBitcoin]) {
      const result = validateHoldingSubmission({ ...submission, management: '' });
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.fieldErrors).toContainEqual(expect.objectContaining({ field: 'management' }));
      }
    }
  });

  it('rejects a whitespace-only Management value', () => {
    const result = validateHoldingSubmission({ ...validShare, management: '   ' });
    expect(result.valid).toBe(false);
  });
});

describe('validateHoldingSubmission — positivity rules', () => {
  it('rejects zero or negative quantity', () => {
    for (const quantity of ['0', '-1', '-0.01']) {
      const result = validateHoldingSubmission({ ...validShare, quantity });
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.fieldErrors).toContainEqual(expect.objectContaining({ field: 'quantity' }));
      }
    }
  });

  it('rejects zero or negative purchasePrice', () => {
    const result = validateHoldingSubmission({ ...validShare, purchasePrice: '-5' });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.fieldErrors).toContainEqual(
        expect.objectContaining({ field: 'purchasePrice' }),
      );
    }
  });

  it('rejects zero or negative weightGrams', () => {
    const result = validateHoldingSubmission({ ...validGold, weightGrams: '-1' });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.fieldErrors).toContainEqual(expect.objectContaining({ field: 'weightGrams' }));
    }
  });

  it('rejects zero or negative currentValue when provided', () => {
    const result = validateHoldingSubmission({ ...validGold, currentValue: '-100' });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.fieldErrors).toContainEqual(expect.objectContaining({ field: 'currentValue' }));
    }
  });

  it('accepts Gold with no currentValue at all (optional)', () => {
    const result = validateHoldingSubmission(validGold);
    expect(result.valid).toBe(true);
  });
});

describe('validateHoldingSubmission — purchaseDate rules', () => {
  it('accepts a past purchaseDate for Share/Bitcoin', () => {
    const result = validateHoldingSubmission({ ...validShare, purchaseDate: '2020-01-01' });
    expect(result.valid).toBe(true);
  });

  it('accepts an omitted purchaseDate for Share/Bitcoin', () => {
    const result = validateHoldingSubmission(validBitcoin);
    expect(result.valid).toBe(true);
  });

  it('rejects a future purchaseDate for Share/Bitcoin', () => {
    const future = new Date();
    future.setFullYear(future.getFullYear() + 1);
    const result = validateHoldingSubmission({
      ...validShare,
      purchaseDate: future.toISOString().slice(0, 10),
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.fieldErrors).toContainEqual(expect.objectContaining({ field: 'purchaseDate' }));
    }
  });
});

describe('validateHoldingSubmission — per-type required fields', () => {
  it('rejects ETF missing isin/name/quantity/purchasePrice', () => {
    const { isin: _isin, ...withoutIsin } = validEtf;
    const result = validateHoldingSubmission(withoutIsin as HoldingSubmission);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.fieldErrors).toContainEqual(expect.objectContaining({ field: 'isin' }));
    }
  });

  it('rejects ETF with a malformed ISIN', () => {
    const result = validateHoldingSubmission({ ...validEtf, isin: 'NOT-AN-ISIN' });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.fieldErrors).toContainEqual(expect.objectContaining({ field: 'isin' }));
    }
  });

  it('rejects ETF that includes a purchaseDate — ETF never has one (FR-005)', () => {
    const result = validateHoldingSubmission({
      ...validEtf,
      purchaseDate: '2020-01-01',
    } as HoldingSubmission);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.fieldErrors).toContainEqual(expect.objectContaining({ field: 'purchaseDate' }));
    }
  });

  it('rejects Precious metal missing weightGrams', () => {
    const { weightGrams: _weightGrams, ...withoutWeight } = validGold;
    const result = validateHoldingSubmission(withoutWeight as HoldingSubmission);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.fieldErrors).toContainEqual(expect.objectContaining({ field: 'weightGrams' }));
    }
  });

  it('rejects Precious metal with extraneous fields for the wrong type (isin/purchasePrice)', () => {
    const result = validateHoldingSubmission({
      ...validGold,
      isin: 'US0378331005',
      purchasePrice: '10',
    } as HoldingSubmission);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.fieldErrors.length).toBeGreaterThan(0);
    }
  });

  it('rejects Crypto missing quantity/purchasePrice', () => {
    const { quantity: _quantity, ...withoutQuantity } = validBitcoin;
    const result = validateHoldingSubmission(withoutQuantity as HoldingSubmission);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.fieldErrors).toContainEqual(expect.objectContaining({ field: 'quantity' }));
    }
  });

  it('rejects Crypto with extraneous fields for the wrong type (isin/weightGrams)', () => {
    const result = validateHoldingSubmission({
      ...validBitcoin,
      isin: 'US0378331005',
      weightGrams: '10',
    } as HoldingSubmission);
    expect(result.valid).toBe(false);
  });

  it('rejects Share missing isin/name/quantity/purchasePrice', () => {
    const { name: _name, ...withoutName } = validShare;
    const result = validateHoldingSubmission(withoutName as HoldingSubmission);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.fieldErrors).toContainEqual(expect.objectContaining({ field: 'name' }));
    }
  });

  it('rejects Precious metal with a blank/whitespace-only name (FR-009, SC-004)', () => {
    for (const name of ['', '   ']) {
      const result = validateHoldingSubmission({ ...validGold, name });
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.fieldErrors).toContainEqual({
          field: 'name',
          message: 'name is required for PRECIOUS_METAL.',
        });
      }
    }
  });

  it('rejects Crypto with a blank/whitespace-only name (FR-009, SC-004)', () => {
    for (const name of ['', '   ']) {
      const result = validateHoldingSubmission({ ...validBitcoin, name });
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.fieldErrors).toContainEqual({
          field: 'name',
          message: 'name is required for CRYPTO.',
        });
      }
    }
  });

  it('rejects the old GOLD/BITCOIN asset-type values with a field error on assetType (FR-011)', () => {
    for (const assetType of ['GOLD', 'BITCOIN']) {
      const result = validateHoldingSubmission({
        assetType: assetType as HoldingSubmission['assetType'],
        management: 'Private',
      });
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.fieldErrors).toContainEqual(expect.objectContaining({ field: 'assetType' }));
      }
    }
  });

  it('accepts free-text names for Precious metal/Crypto, not just Gold/Bitcoin', () => {
    const silver = validateHoldingSubmission({ ...validGold, name: 'Silver' });
    expect(silver.valid).toBe(true);
    const ethereum = validateHoldingSubmission({ ...validBitcoin, name: 'Ethereum' });
    expect(ethereum.valid).toBe(true);
  });
});

describe('validateHoldingSubmission — parsed value shape', () => {
  it('returns Decimal-typed numeric fields and a Date-typed purchaseDate on success', () => {
    const result = validateHoldingSubmission({ ...validShare, purchaseDate: '2020-01-01' });
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.value.quantity).toBeInstanceOf(Decimal);
      expect(result.value.quantity?.equals(new Decimal('10'))).toBe(true);
      expect(result.value.purchasePrice?.equals(new Decimal('150.00'))).toBe(true);
      expect(result.value.purchaseDate).toBeInstanceOf(Date);
    }
  });

  it('reports every failing field at once, not just the first (SC-002)', () => {
    const result = validateHoldingSubmission({
      assetType: 'SHARE',
      management: '',
      isin: 'INVALID',
      name: '',
      quantity: '-1',
      purchasePrice: '-1',
    } as HoldingSubmission);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      const fields = result.fieldErrors.map((error) => error.field);
      expect(fields).toEqual(
        expect.arrayContaining(['management', 'isin', 'name', 'quantity', 'purchasePrice']),
      );
    }
  });
});
