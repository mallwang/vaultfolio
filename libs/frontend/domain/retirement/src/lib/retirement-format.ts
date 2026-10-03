/**
 * Locale formatting for the Retirement views. Amounts arrive as exact decimal strings; they are
 * only converted to numbers here, at display time — never for arithmetic.
 */
export function formatMoney(value: string | null | undefined, lang: string): string {
  if (value === null || value === undefined || value === '') return '–';
  return new Intl.NumberFormat(lang, {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value));
}

/** `YYYY-MM-DD` → localised calendar date. */
export function formatDate(iso: string | null | undefined, lang: string): string {
  if (!iso) return '–';
  const [y, m, d] = iso.split('-').map(Number);
  return new Intl.DateTimeFormat(lang, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(Date.UTC(y, m - 1, d));
}

/** Decimal string (earnings points, interest rate) → locale number with its own places. */
export function formatDecimal(value: string, lang: string): string {
  const places = value.split('.')[1]?.length ?? 0;
  return new Intl.NumberFormat(lang, {
    minimumFractionDigits: places,
    maximumFractionDigits: places,
  }).format(Number(value));
}

/**
 * Parses what a person types into a money field (`60`, `60,5`, `1.234,56`, `1234.56`) into the
 * canonical decimal string (`60.00`-style is not forced: `60`, `60.5`). `null` for anything else.
 */
export function parseMoneyInput(text: string): string | null {
  const trimmed = text.trim().replaceAll(/\s/g, '');
  if (trimmed === '') return null;
  const german = /^\d{1,3}(\.\d{3})+(,\d{1,2})?$|^\d+(,\d{1,2})?$/.test(trimmed);
  const plain = /^\d+(\.\d{1,2})?$/.test(trimmed);
  if (german) return trimmed.replaceAll('.', '').replace(',', '.');
  return plain ? trimmed : null;
}

/** A canonical decimal string for the input box (`1234.5` → `1234,50` in German). */
export function toMoneyInput(value: string | undefined, lang: string): string {
  if (value === undefined) return '';
  const text = Number(value).toFixed(2);
  return lang === 'de' ? text.replace('.', ',') : text;
}

/** Fills `{{name}}` placeholders. */
export function fill(text: string, params: Record<string, string | number>): string {
  return text.replaceAll(/\{\{(\w+)\}\}/g, (_, key: string) => String(params[key] ?? ''));
}

/** Figure keys shown as a date. */
const DATE_KEYS = new Set(['dataPeriodFrom', 'dataPeriodTo', 'statementDate', 'payoutStart']);

/**
 * Display text of one stored figure by key: dates, years (`guaranteePeriodYears`), the interest
 * rate as a percentage, earnings points as a plain number and everything else as euros.
 */
export function displayFigure(
  key: string,
  value: unknown,
  lang: string,
  yearsLabel: string,
): string {
  if (typeof value === 'number') return `${value} ${yearsLabel}`;
  const text = String(value);
  if (DATE_KEYS.has(key)) return formatDate(text, lang);
  if (key === 'guaranteedInterestRate') return `${formatDecimal(text, lang)} %`;
  return key === 'earningsPoints' ? formatDecimal(text, lang) : formatMoney(text, lang);
}
