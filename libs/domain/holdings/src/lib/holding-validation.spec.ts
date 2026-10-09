import { isValidIsin, validateHoldingSubmission } from './holding-validation.js';
import type { HoldingSubmission } from './holding-validation.js';

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
  metal: 'XAU',
  quantity: '2',
  unit: 'OZT',
  purchasePrice: '1800.00',
};
const validBitcoin: HoldingSubmission = {
  assetType: 'CRYPTO',
  management: 'Kraken',
  coinId: 'bitcoin',
  quantity: '0.25',
  purchasePrice: '42000.00',
};
const validDeposit: HoldingSubmission = {
  assetType: 'DEPOSIT_MONEY',
  management: 'N26',
  name: 'N26 checking',
  currentValue: '1250.00',
};

function errorsOf(submission: HoldingSubmission): { field: string; code: string }[] {
  const result = validateHoldingSubmission(submission);
  if (result.valid) throw new Error('expected invalid');
  return result.fieldErrors;
}

describe('isValidIsin', () => {
  it('accepts well-formed ISINs with a correct check digit', () => {
    expect(isValidIsin('IE00B4L5Y983')).toBe(true);
    expect(isValidIsin('US0378331005')).toBe(true);
  });

  it('rejects wrong check digit, wrong length and lowercase', () => {
    expect(isValidIsin('US0378331006')).toBe(false);
    expect(isValidIsin('US037833100')).toBe(false);
    expect(isValidIsin('us0378331005')).toBe(false);
  });
});

describe('validateHoldingSubmission - valid submissions', () => {
  it.each([validEtf, validShare, validGold, validBitcoin, validDeposit])(
    'accepts a valid $assetType',
    (submission) => {
      expect(validateHoldingSubmission(submission).valid).toBe(true);
    },
  );

  it('parses an ETF into exact domain types with null for inapplicable fields', () => {
    const result = validateHoldingSubmission({ ...validEtf, note: 'core' });
    if (!result.valid) throw new Error('expected valid');
    const v = result.value;
    expect(v.quantity?.toFixed()).toBe('12.5');
    expect(v.purchasePrice?.toFixed()).toBe('78.42');
    expect([v.note, v.metal, v.unit, v.coinId, v.currentValue]).toEqual([
      'core',
      null,
      null,
      null,
      null,
    ]);
  });

  it('parses a metal with its unit and purchase price', () => {
    const result = validateHoldingSubmission(validGold);
    if (!result.valid) throw new Error('expected valid');
    expect([result.value.metal, result.value.unit, result.value.currentValue]).toEqual([
      'XAU',
      'OZT',
      null,
    ]);
  });

  it('allows currentValue 0 on a deposit', () => {
    expect(validateHoldingSubmission({ ...validDeposit, currentValue: '0' }).valid).toBe(true);
  });

  it('keeps huge quantity and price exact', () => {
    const result = validateHoldingSubmission({
      ...validEtf,
      quantity: '123456789012345678.123456789',
      purchasePrice: '99999999999999999.99',
    });
    if (!result.valid) throw new Error('expected valid');
    expect(result.value.quantity?.toFixed()).toBe('123456789012345678.123456789');
    expect(result.value.purchasePrice?.toFixed()).toBe('99999999999999999.99');
  });
});

describe('validateHoldingSubmission - errors', () => {
  it('rejects an unknown asset type', () => {
    expect(errorsOf({ ...validEtf, assetType: 'GOLD' as never })).toEqual([
      { field: 'assetType', code: 'REQUIRED' },
    ]);
  });

  it('reports every missing required field at once', () => {
    expect(errorsOf({ assetType: 'ETF', management: ' ' })).toEqual([
      { field: 'management', code: 'REQUIRED' },
      { field: 'isin', code: 'REQUIRED' },
      { field: 'name', code: 'REQUIRED' },
      { field: 'quantity', code: 'REQUIRED' },
      { field: 'purchasePrice', code: 'REQUIRED' },
    ]);
  });

  it('rejects a malformed ISIN', () => {
    expect(errorsOf({ ...validEtf, isin: 'US0378331006' })).toEqual([
      { field: 'isin', code: 'ISIN_INVALID' },
    ]);
  });

  it.each([validGold, validBitcoin, validDeposit])('rejects isin on $assetType', (submission) => {
    expect(errorsOf({ ...submission, isin: 'US0378331005' })).toEqual([
      { field: 'isin', code: 'ISIN_NOT_ALLOWED' },
    ]);
  });

  it('rejects other fields not listed for the type', () => {
    expect(errorsOf({ ...validGold, name: 'Gold' })).toEqual([
      { field: 'name', code: 'FIELD_NOT_ALLOWED' },
    ]);
  });

  it('rejects a free-text metal, unknown coin and invalid unit', () => {
    expect(errorsOf({ ...validGold, metal: 'Gold' })).toEqual([
      { field: 'metal', code: 'METAL_UNKNOWN' },
    ]);
    expect(errorsOf({ ...validBitcoin, coinId: 'Bitcoin' })).toEqual([
      { field: 'coinId', code: 'COIN_UNKNOWN' },
    ]);
    expect(errorsOf({ ...validGold, unit: 'KG' })).toEqual([
      { field: 'unit', code: 'UNIT_INVALID' },
    ]);
  });

  it.each(['0', '-1'])('rejects quantity %s', (quantity) => {
    expect(errorsOf({ ...validEtf, quantity })).toEqual([
      { field: 'quantity', code: 'QUANTITY_NOT_POSITIVE' },
    ]);
    expect(errorsOf({ ...validGold, quantity })).toEqual([
      { field: 'quantity', code: 'QUANTITY_NOT_POSITIVE' },
    ]);
  });

  it('rejects a non-numeric or non-finite decimal', () => {
    expect(errorsOf({ ...validEtf, purchasePrice: 'abc' })).toEqual([
      { field: 'purchasePrice', code: 'DECIMAL_INVALID' },
    ]);
    expect(errorsOf({ ...validDeposit, currentValue: 'Infinity' })).toEqual([
      { field: 'currentValue', code: 'DECIMAL_INVALID' },
    ]);
  });

  it('rejects a negative currentValue', () => {
    expect(errorsOf({ ...validDeposit, currentValue: '-0.01' })).toEqual([
      { field: 'currentValue', code: 'DECIMAL_INVALID' },
    ]);
  });
});

describe('validateHoldingSubmission - crypto quantity decimals', () => {
  it('accepts 8 decimals', () => {
    expect(validateHoldingSubmission({ ...validBitcoin, quantity: '0.00000001' }).valid).toBe(true);
  });

  it('rejects 9 decimals', () => {
    expect(errorsOf({ ...validBitcoin, quantity: '0.000000001' })).toEqual([
      { field: 'quantity', code: 'QUANTITY_DECIMALS' },
    ]);
  });
});

describe('validateHoldingSubmission - note', () => {
  it('accepts 500 characters and rejects 501', () => {
    expect(validateHoldingSubmission({ ...validEtf, note: 'a'.repeat(500) }).valid).toBe(true);
    expect(errorsOf({ ...validEtf, note: 'a'.repeat(501) })).toEqual([
      { field: 'note', code: 'NOTE_TOO_LONG' },
    ]);
  });

  it('counts code points: 500 emoji ok, 501 rejected', () => {
    expect(validateHoldingSubmission({ ...validEtf, note: '😀'.repeat(500) }).valid).toBe(true);
    expect(errorsOf({ ...validEtf, note: '😀'.repeat(501) })).toEqual([
      { field: 'note', code: 'NOTE_TOO_LONG' },
    ]);
  });

  it('stores a blank note as null', () => {
    const result = validateHoldingSubmission({ ...validEtf, note: '  ' });
    if (!result.valid) throw new Error('expected valid');
    expect(result.value.note).toBeNull();
  });
});
