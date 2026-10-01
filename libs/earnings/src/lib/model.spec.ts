import {
  add,
  centsToMoney,
  divide,
  isMoney,
  monthsBetween,
  neg,
  normalizeEmployerName,
  parseMoney,
  ratio,
  sub,
  sum,
  toMoney,
  withinTolerance,
} from './model';

describe('money helpers', () => {
  it('accepts only canonical decimal strings', () => {
    expect(isMoney('1234.56')).toBe(true);
    expect(isMoney('-45.00')).toBe(true);
    expect(isMoney('0.00')).toBe(true);
    expect(isMoney('1.5')).toBe(false);
    expect(isMoney('1,00')).toBe(false);
    expect(isMoney('1234')).toBe(false);
    expect(isMoney(1.5)).toBe(false);
    expect(isMoney('1234567890.00')).toBe(false);
  });

  it('parseMoney rejects floats and non-canonical strings', () => {
    expect(() => parseMoney(1.5 as unknown as string)).toThrow(TypeError);
    expect(() => parseMoney('1,00')).toThrow(TypeError);
    expect(() => parseMoney('1.5')).toThrow(TypeError);
    expect(parseMoney('1234.56').toFixed(2)).toBe('1234.56');
  });

  it('formats with two decimals, half-up, without negative zero', () => {
    expect(toMoney('1234.565')).toBe('1234.57');
    expect(toMoney('-0.004')).toBe('0.00');
    expect(toMoney(0)).toBe('0.00');
    expect(toMoney('-22.1')).toBe('-22.10');
  });

  it('adds, subtracts, negates and sums exactly', () => {
    expect(add('0.10', '0.20')).toBe('0.30');
    expect(sub('3750.00', '591.70')).toBe('3158.30');
    expect(sub('10.00', '12.40')).toBe('-2.40');
    expect(neg('45.00')).toBe('-45.00');
    expect(neg('0.00')).toBe('0.00');
    expect(sum([])).toBe('0.00');
    expect(sum(['1234.56', '-22.07', '0.01'])).toBe('1212.50');
  });

  it('converts cents exactly', () => {
    expect(centsToMoney(123456)).toBe('1234.56');
    expect(centsToMoney(-2207)).toBe('-22.07');
    expect(centsToMoney(5)).toBe('0.05');
    expect(centsToMoney(0)).toBe('0.00');
    expect(() => centsToMoney(1.5)).toThrow(TypeError);
  });

  it('computes ratios to 4 decimal places', () => {
    expect(ratio('3080.00', '5000.00')).toBe('0.6160');
    expect(ratio('1.00', '3.00')).toBe('0.3333');
    expect(ratio('2.00', '3.00')).toBe('0.6667');
    expect(ratio('1.00', '0.00')).toBe('0.0000');
  });

  it('divides into per-month averages', () => {
    expect(divide('10000.00', 3)).toBe('3333.33');
    expect(divide('10.00', 0)).toBe('0.00');
  });

  it('checks the one-cent tolerance inclusively', () => {
    expect(withinTolerance('100.00', '100.01')).toBe(true);
    expect(withinTolerance('100.00', '99.99')).toBe(true);
    expect(withinTolerance('100.00', '100.02')).toBe(false);
  });
});

describe('period and name helpers', () => {
  it('counts months between periods', () => {
    expect(monthsBetween('2026-07', '2026-09')).toBe(2);
    expect(monthsBetween('2025-11', '2026-02')).toBe(3);
    expect(monthsBetween('2026-09', '2026-09')).toBe(0);
  });

  it('normalizes employer names', () => {
    expect(normalizeEmployerName('  Brightline   Software\tGmbH ')).toBe(
      'Brightline Software GmbH',
    );
  });
});
