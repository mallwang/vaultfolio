/**
 * Locale formatting for the insurances views. Amounts arrive as exact decimal strings; they are
 * only converted to numbers here, at display time — never for arithmetic (that lives in
 * `@vaultfolio/insurances`).
 */
export function formatMoney(value: string | null | undefined, lang: string, whole = false): string {
  if (value === null || value === undefined || value === '') return '–';
  return new Intl.NumberFormat(lang, {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  }).format(Number(value));
}

/** `YYYY-MM-DD` → locale date with the month written out, rendered in UTC so the day never shifts. */
export function formatDate(iso: string, lang: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Intl.DateTimeFormat(lang, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(Date.UTC(y, m - 1, d));
}

/** `YYYY-MM-DD` → compact locale date (`30.09.2026`). */
export function formatDateShort(iso: string, lang: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Intl.DateTimeFormat(lang, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(Date.UTC(y, m - 1, d));
}

/** Month name (`März`) for a 1-based month. */
export function monthName(month: number, lang: string, style: 'long' | 'short' = 'long'): string {
  return new Intl.DateTimeFormat(lang, { month: style, timeZone: 'UTC' }).format(
    Date.UTC(2000, month - 1, 1),
  );
}

/** Replaces `{{name}}` placeholders. */
export function fill(template: string, params: Record<string, string | number> = {}): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_m, key: string) => String(params[key] ?? ''));
}

/** Parses a user-typed amount (`1.200,50`, `1200.5`) into a plain decimal string; `null` if unreadable. */
export function parseAmountInput(text: string): string | null {
  const compact = text.trim().replaceAll(/[\s'’€]/g, '');
  if (!compact || /[.,]{2}/.test(compact)) return null;
  const lastComma = compact.lastIndexOf(',');
  const lastDot = compact.lastIndexOf('.');
  let normalized = compact;
  if (lastComma >= 0 && lastDot >= 0) {
    normalized =
      lastComma > lastDot
        ? compact.replaceAll('.', '').replace(',', '.')
        : compact.replaceAll(',', '');
  } else if (lastComma >= 0) {
    normalized = compact.replaceAll(',', '.');
    if ((normalized.match(/\./g) ?? []).length > 1) normalized = normalized.replaceAll('.', '');
  } else if (lastDot >= 0) {
    const dots = compact.match(/\./g) ?? [];
    const afterLast = compact.length - lastDot - 1;
    if (dots.length > 1 || afterLast === 3) normalized = compact.replaceAll('.', '');
  }
  return /^\d+(\.\d+)?$/.test(normalized) ? normalized : null;
}
