import { collectCheckFailures, editableKeys } from './checks';
import { applyCorrection, parseMoneyInput } from './corrections';
import { payRecord } from './testing/builders';

describe('parseMoneyInput', () => {
  it.each([
    ['1234.56', '1234.56'],
    ['1.234,56', '1234.56'],
    ['-45,00', '-45.00'],
    ['1,234.56', '1234.56'],
    [' 520 ', '520.00'],
    ['0,50', '0.50'],
    ['-0,00', '0.00'],
    ['12.345.678,90', '12345678.90'],
  ])('reads %j as %j', (text, expected) => {
    expect(parseMoneyInput(text)).toBe(expected);
  });

  it.each(['52x', '', '   ', '1.5', '1,5', '1.234', '1234.567', '12.345,6', '1.2.3,00', '--5,00'])(
    'rejects %j',
    (text) => {
      expect(parseMoneyInput(text)).toBeNull();
    },
  );

  it('rejects values beyond nine integer digits', () => {
    expect(parseMoneyInput('1234567890.00')).toBeNull();
    expect(parseMoneyInput('123456789.00')).toBe('123456789.00');
  });
});

describe('applyCorrection', () => {
  const off = payRecord({ amounts: { net: '3162.00', payout: '3162.00' } });
  const editable = editableKeys(collectCheckFailures([off]));

  it('replaces exactly one figure and marks it once', () => {
    const out = applyCorrection(
      [off],
      { recordIndex: 0, key: 'wageTax', value: '818.00' },
      editable,
    );
    expect(out).toEqual([
      { ...off, amounts: { ...off.amounts, wageTax: '818.00' }, corrected: ['wageTax'] },
    ]);
    const again = applyCorrection(
      out ?? [],
      { recordIndex: 0, key: 'wageTax', value: '819.00' },
      editable,
    );
    expect(again?.[0].amounts.wageTax).toBe('819.00');
    expect(again?.[0].corrected).toEqual(['wageTax']);
  });

  it('never mutates its input', () => {
    const snapshot = structuredClone(off);
    applyCorrection([off], { recordIndex: 0, key: 'net', value: '3180.00' }, editable);
    expect(off).toEqual(snapshot);
  });

  it('returns null for a figure outside the editable set', () => {
    expect(
      applyCorrection([off], { recordIndex: 0, key: 'wageTax', value: '1.00' }, [
        { recordIndex: 0, key: 'net' },
      ]),
    ).toBeNull();
    expect(
      applyCorrection([off], { recordIndex: 3, key: 'net', value: '1.00' }, editable),
    ).toBeNull();
  });

  it('removes the marker again when the read value is put back', () => {
    const corrected = applyCorrection(
      [off],
      { recordIndex: 0, key: 'net', value: '3180.00' },
      editable,
      [off],
    );
    expect(corrected?.[0].corrected).toEqual(['net']);
    const restored = applyCorrection(
      corrected ?? [],
      { recordIndex: 0, key: 'net', value: '3162.00' },
      editable,
      [off],
    );
    expect(restored).toEqual([off]);
    expect(restored?.[0]).not.toHaveProperty('corrected');
  });

  it('makes a failing file pass once the right figure is entered', () => {
    const fixed = applyCorrection(
      [off],
      { recordIndex: 0, key: 'net', value: '3180.00' },
      editable,
    );
    expect(collectCheckFailures(fixed ?? [])).toEqual([
      expect.objectContaining({ check: 'PAYOUT', difference: '-18.00' }),
    ]);
    const both = applyCorrection(
      fixed ?? [],
      { recordIndex: 0, key: 'payout', value: '3180.00' },
      editable,
    );
    expect(collectCheckFailures(both ?? [])).toEqual([]);
  });
});
