import {
  fill,
  formatDate,
  formatDateShort,
  formatMoney,
  monthName,
  parseAmountInput,
  reminderSendDate,
} from './insurances-format';

describe('reminderSendDate', () => {
  it('is the deadline minus the lead days', () => {
    expect(reminderSendDate('2026-10-31', 30, '2026-09-01')).toBe('2026-10-01');
  });

  it('crosses month and year boundaries', () => {
    expect(reminderSendDate('2027-01-10', 30, '2026-09-01')).toBe('2026-12-11');
  });

  it('is today when the deadline is already inside the lead window', () => {
    expect(reminderSendDate('2026-09-20', 30, '2026-09-10')).toBe('2026-09-10');
  });
});

describe('insurances format', () => {
  it('formats money in the locale and shows a dash without value', () => {
    expect(formatMoney('1234.5', 'en')).toBe('€1,234.50');
    expect(formatMoney('1234.5', 'de')).toContain('1.234,50');
    expect(formatMoney('96', 'en', true)).toBe('€96');
    expect(formatMoney(null, 'en')).toBe('–');
  });

  it('formats dates in UTC without shifting the day', () => {
    expect(formatDate('2026-09-30', 'en')).toBe('September 30, 2026');
    expect(formatDateShort('2026-09-30', 'de')).toBe('30.09.2026');
    expect(monthName(3, 'en')).toBe('March');
  });

  it('fills placeholders', () => {
    expect(fill('{{a}} and {{b}} {{c}}', { a: 1, b: 'x' })).toBe('1 and x ');
  });

  it.each([
    ['1.200,50', '1200.50'],
    ['1200.5', '1200.5'],
    ['12,5', '12.5'],
    ['1.234.567', '1234567'],
    ['96', '96'],
    ['€ 96,00', '96.00'],
  ])('parses %s', (input, expected) => {
    expect(parseAmountInput(input)).toBe(expected);
  });

  it.each(['', 'abc', '1,,2', '-5'])('rejects %j', (input) => {
    expect(parseAmountInput(input)).toBeNull();
  });
});
