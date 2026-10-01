import type { EarningsRejection } from '@vaultfolio/api-contract';

/**
 * Locale formatting for the Earnings views (FR-048). Amounts arrive as exact decimal strings; they
 * are only converted to numbers here, at display time, with two decimals — never for arithmetic.
 */
export function formatMoney(
  value: string | null | undefined,
  lang: string,
  options: { signed?: boolean; whole?: boolean } = {},
): string {
  if (value === null || value === undefined || value === '') return '–';
  return new Intl.NumberFormat(lang, {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: options.whole ? 0 : 2,
    maximumFractionDigits: options.whole ? 0 : 2,
    signDisplay: options.signed ? 'exceptZero' : 'auto',
  }).format(Number(value));
}

/** Ratio string (`"0.6160"`) → percentage (`61.6 %`). */
export function formatPercent(ratio: string | number, lang: string, digits = 1): string {
  return new Intl.NumberFormat(lang, {
    style: 'percent',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Number(ratio));
}

/** `part` as a share of `gross` (`38.4 %`); `null` without a positive gross. */
export function formatShareOfGross(part: string, gross: string, lang: string): string | null {
  const total = Number(gross);
  return total > 0 ? formatPercent(Number(part) / total, lang) : null;
}

/** `YYYY-MM` → `Sep 2026` / `Sep. 2026` (or the long month name). */
export function formatMonth(
  period: string,
  lang: string,
  month: 'short' | 'long' = 'short',
): string {
  const [y, m] = period.split('-').map(Number);
  return new Intl.DateTimeFormat(lang, { month, year: 'numeric', timeZone: 'UTC' }).format(
    Date.UTC(y, m - 1, 1),
  );
}

/** Month number (1–12) → short month name. */
export function monthName(month: number, lang: string): string {
  return new Intl.DateTimeFormat(lang, { month: 'short', timeZone: 'UTC' }).format(
    Date.UTC(2000, month - 1, 1),
  );
}

export function formatDate(iso: string, lang: string): string {
  return new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'short', year: 'numeric' }).format(
    new Date(iso),
  );
}

/** Replaces `{{name}}` placeholders. */
export function fill(template: string, params: Record<string, string | number> = {}): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_m, key: string) => String(params[key] ?? ''));
}

/** Translated, formatted explanation of a rejected file (FR-012, FR-014, FR-046). */
export function rejectionText(
  rejection: EarningsRejection,
  translate: (key: string) => string,
  lang: string,
  templateKey?: string,
): string {
  const p = rejection.params ?? {};
  const params: Record<string, string> = { ...p };
  if (p['period'])
    params['period'] = /^\d{4}-\d{2}$/.test(p['period'])
      ? formatMonth(p['period'], lang)
      : p['period'];
  if (p['difference']) params['difference'] = formatMoney(p['difference'], lang, { signed: true });
  if (p['check']) params['check'] = translate(`earnings.check.${p['check']}`);
  const key = templateKey ?? `earnings.errors.${rejection.code}`;
  const template = translate(key);
  return fill(template === key ? translate('earnings.errors.generic') : template, params);
}
