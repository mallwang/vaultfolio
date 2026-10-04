import {
  fill,
  formatDate,
  formatMoney,
  formatPct,
  formatShare,
  parseAmountInput,
} from './wealth-format';

describe('wealth-format', () => {
  it('formats money with sign options and a dash for blanks', () => {
    expect(formatMoney('12000.50', 'de')).toBe('12.000,50 €');
    expect(formatMoney('-5.00', 'en')).toBe('-€5.00');
    expect(formatMoney('5.00', 'en', { signed: true })).toBe('+€5.00');
    expect(formatMoney('1234.00', 'en', { whole: true })).toBe('€1,234');
    expect(formatMoney(null, 'en')).toBe('–');
    expect(formatMoney('', 'en')).toBe('–');
  });

  it('formats percent strings and n/a', () => {
    expect(formatPct('12.50', 'en', 'n/a')).toBe('+12.5%');
    expect(formatPct('-3.00', 'en', 'n/a')).toBe('-3.0%');
    expect(formatPct(null, 'en', 'n/a')).toBe('n/a');
  });

  it('formats a share and guards a non-positive total', () => {
    expect(formatShare('25.00', '100.00', 'en')).toBe('25.0%');
    expect(formatShare('1.00', '0.00', 'en')).toBe('–');
  });

  it('formats an ISO date in UTC without shifting the day', () => {
    expect(formatDate('2026-09-30', 'en')).toBe('September 30, 2026');
    expect(formatDate('2026-01-01', 'de')).toBe('1. Januar 2026');
  });

  it('fills placeholders', () => {
    expect(fill('A {{x}} B {{y}} {{z}}', { x: 1, y: 'two' })).toBe('A 1 B two ');
  });

  it.each([
    ['12.000,50', '12000.50'],
    ['12,000.50', '12000.50'],
    ['12000.5', '12000.5'],
    ['12 000,5', '12000.5'],
    ['1.234.567', '1234567'],
    ['12.000', '12000'],
    ['0,99', '0.99'],
    ['1,5', '1.5'],
    ['€ 7', '7'],
  ])('parses %p as %p', (text, expected) => {
    expect(parseAmountInput(text)).toBe(expected);
  });

  it.each(['', '  ', 'abc', '-5', '1,2,3x', '1..2'])('rejects %p', (text) => {
    expect(parseAmountInput(text)).toBeNull();
  });
});
