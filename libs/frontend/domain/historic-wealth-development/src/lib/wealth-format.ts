/**
 * Locale formatting for the wealth views. Amounts arrive as exact decimal strings; they are only
 * converted to numbers here, at display time — never for arithmetic (that lives in
 * `@vaultfolio/wealth`).
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

/** Percent string from `@vaultfolio/wealth` (`"12.50"` = 12.5 %) → `+12,5 %`; `null` → `notAvailable`. */
export function formatPct(pct: string | null, lang: string, notAvailable: string): string {
  if (pct === null) return notAvailable;
  return new Intl.NumberFormat(lang, {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
    signDisplay: 'exceptZero',
  }).format(Number(pct) / 100);
}

/** Whole-number percent formatter (`38 %`) for chart tooltips. */
export function percentFormat(lang: string): Intl.NumberFormat {
  return new Intl.NumberFormat(lang, { style: 'percent', maximumFractionDigits: 0 });
}

/** Share of `part` in `total` as a percentage (`38,4 %`); `–` without a positive total. */
export function formatShare(part: string, total: string, lang: string): string {
  const whole = Number(total);
  if (Number.isNaN(whole) || whole <= 0) return '–';
  return new Intl.NumberFormat(lang, {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(Number(part) / whole);
}

/** `YYYY-MM-DD` → locale date with the month written out (`30. September 2026`), rendered in UTC so the day never shifts. */
export function formatDate(iso: string, lang: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Intl.DateTimeFormat(lang, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(Date.UTC(y, m - 1, d));
}

/** Replaces `{{name}}` placeholders. */
export function fill(template: string, params: Record<string, string | number> = {}): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_m, key: string) => String(params[key] ?? ''));
}

/** Parses a user-typed amount (`12.000,50`, `12000.5`, `12 000,5`) into a plain decimal string. */
export function parseAmountInput(text: string): string | null {
  const compact = text.trim().replace(/[\s'’€]/g, '');
  if (!compact || /[.,]{2}/.test(compact)) return null;
  const lastComma = compact.lastIndexOf(',');
  const lastDot = compact.lastIndexOf('.');
  let normalized = compact;
  if (lastComma >= 0 && lastDot >= 0) {
    // The later separator is the decimal one; the other groups thousands.
    normalized =
      lastComma > lastDot
        ? compact.replace(/\./g, '').replace(',', '.')
        : compact.replace(/,/g, '');
  } else if (lastComma >= 0) {
    normalized = compact.replace(/,/g, '.');
    if ((normalized.match(/\./g) ?? []).length > 1) normalized = normalized.replace(/\./g, '');
  } else if (lastDot >= 0) {
    const dots = compact.match(/\./g) ?? [];
    const afterLast = compact.length - lastDot - 1;
    // "12.000" / "1.234.567" read as thousands grouping; "12.5" / "12.50" as decimals.
    if (dots.length > 1 || afterLast === 3) normalized = compact.replace(/\./g, '');
  }
  return /^\d+(\.\d+)?$/.test(normalized) ? normalized : null;
}

/** Direction of a change (`delta` as decimal string) for the green / red / grey coloring. */
export type ChangeTone = 'up' | 'down' | 'flat';

export function changeTone(delta: string | null | undefined): ChangeTone {
  const value = Number(delta);
  if (delta === null || delta === undefined || Number.isNaN(value) || value === 0) return 'flat';
  return value > 0 ? 'up' : 'down';
}
