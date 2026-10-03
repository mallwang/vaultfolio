import {
  fill,
  formatDate,
  formatDecimal,
  formatMoney,
  parseMoneyInput,
  toMoneyInput,
} from './retirement-format';

describe('retirement-format', () => {
  it('formats money and dates per language, and shows a dash for nothing', () => {
    expect(formatMoney('1234.5', 'de').replaceAll('\u00a0', ' ')).toBe('1.234,50 €');
    expect(formatMoney('1234.5', 'en')).toContain('1,234.50');
    expect(formatMoney(null, 'de')).toBe('–');
    expect(formatMoney('', 'de')).toBe('–');
    expect(formatDate('2026-03-15', 'de')).toContain('2026');
    expect(formatDate(null, 'de')).toBe('–');
    expect(formatDecimal('28.5000', 'de')).toBe('28,5000');
  });

  it('parses German and plain amounts into canonical decimal strings', () => {
    expect(parseMoneyInput('60')).toBe('60');
    expect(parseMoneyInput('60,5')).toBe('60.5');
    expect(parseMoneyInput('1.234,56')).toBe('1234.56');
    expect(parseMoneyInput('1234.56')).toBe('1234.56');
    expect(parseMoneyInput(' 1 234,56 ')).toBe('1234.56');
    // a dot followed by exactly three digits is a German thousands separator
    expect(parseMoneyInput('12.345')).toBe('12345');
  });

  it('rejects anything that is not an amount', () => {
    for (const bad of ['', 'abc', '1,234,56', '1,234', '-5', '5 €', '1.2.3']) {
      expect(parseMoneyInput(bad)).toBeNull();
    }
  });

  it('writes a canonical value back into the input box', () => {
    expect(toMoneyInput('1234.5', 'de')).toBe('1234,50');
    expect(toMoneyInput('1234.5', 'en')).toBe('1234.50');
    expect(toMoneyInput(undefined, 'de')).toBe('');
  });

  it('fills placeholders', () => {
    expect(fill('{{a}} of {{b}}', { a: 1, b: 'x' })).toBe('1 of x');
  });
});
