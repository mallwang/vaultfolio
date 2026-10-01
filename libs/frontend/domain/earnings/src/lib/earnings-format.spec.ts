import {
  fill,
  formatMoney,
  formatMonth,
  formatPercent,
  monthName,
  rejectionText,
} from './earnings-format';
import { en } from '@vaultfolio/frontend-shared-ui';

function translate(key: string): string {
  const value = key.split('.').reduce<unknown>((n, k) => (n as Record<string, unknown>)?.[k], en);
  return typeof value === 'string' ? value : key;
}

describe('earnings formatting', () => {
  it('formats money per locale, exact to the cent', () => {
    expect(formatMoney('1234.56', 'en')).toBe('€1,234.56');
    expect(formatMoney('1234.56', 'de')).toBe('1.234,56 €');
    expect(formatMoney('-22.07', 'en')).toBe('-€22.07');
    expect(formatMoney('12.40', 'en', { signed: true })).toBe('+€12.40');
    expect(formatMoney('4908.70', 'en', { whole: true })).toBe('€4,909');
    expect(formatMoney(null, 'en')).toBe('–');
  });

  it('formats ratios as percentages', () => {
    expect(formatPercent('0.6160', 'en')).toBe('61.6%');
    expect(formatPercent('0.6160', 'de')).toBe('61,6 %');
  });

  it('formats months', () => {
    expect(formatMonth('2026-09', 'en')).toBe('Sep 2026');
    expect(formatMonth('2026-03', 'de', 'long')).toBe('März 2026');
    expect(monthName(12, 'de')).toMatch(/^Dez/);
  });

  it('fills placeholders', () => {
    expect(fill('{{a}} of {{b}}', { a: 1, b: 7 })).toBe('1 of 7');
  });

  it('explains a failed check with check name, month and difference', () => {
    expect(
      rejectionText(
        { code: 'CHECK_FAILED', params: { check: 'NET', period: '2026-08', difference: '12.40' } },
        translate,
        'en',
      ),
    ).toBe(
      'Rejected: Gross − taxes − social insurance = net does not add up for Aug 2026 (difference +€12.40). Nothing from this file will be saved.',
    );
    expect(rejectionText({ code: 'IMAGE_ONLY' }, translate, 'en')).toContain(
      'no text that can be read automatically',
    );
  });
});
