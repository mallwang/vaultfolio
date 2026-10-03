import { amountsIn, labelOf, parseGermanAmount, toMoney } from './amount-tokens';

describe('toMoney', () => {
  it.each([
    ['1234.5', '1234.50'],
    ['0.005', '0.01'],
    ['-0.001', '0.00'],
  ])('%s → %s', (input, expected) => {
    expect(toMoney(input)).toBe(expected);
  });
});

describe('parseGermanAmount', () => {
  it.each([
    ['1.234,56', '1234.56'],
    ['591,70-', '-591.70'],
    ['-5,63', '-5.63'],
    ['1.000.000,01', '1000000.01'],
    ['12,5', null],
    ['abc', null],
  ])('%s → %s', (input, expected) => {
    expect(parseGermanAmount(input)).toBe(expected);
  });
});

describe('amountsIn / labelOf', () => {
  it('finds amounts left to right and ignores hours/days quantities', () => {
    expect(amountsIn('Rente 1.234,56 und 78,90 bei 8,00 S')).toEqual(['1234.56', '78.90']);
  });

  it('returns the text before the first amount as label', () => {
    expect(labelOf('Garantierte Rente 1.234,56')).toBe('Garantierte Rente');
  });
});
