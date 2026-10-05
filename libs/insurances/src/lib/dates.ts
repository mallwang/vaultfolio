const DAY_MS = 86_400_000;

export function parseDate(text: string): { y: number; m: number; d: number } {
  const [y, m, d] = text.split('-').map(Number);
  return { y, m, d };
}

export function formatDate(y: number, m: number, d: number): string {
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function isRealDate(text: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const { y, m, d } = parseDate(text);
  return m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(y, m);
}

/** Adds calendar months and clamps the day to the target month's length. */
export function addMonths(date: string, months: number): string {
  const { y, m, d } = parseDate(date);
  const index = y * 12 + (m - 1) + months;
  const ty = Math.floor(index / 12);
  const tm = (index % 12) + 1;
  return formatDate(ty, tm, Math.min(d, daysInMonth(ty, tm)));
}

export function addDays(date: string, days: number): string {
  const { y, m, d } = parseDate(date);
  return new Date(Date.UTC(y, m - 1, d) + days * DAY_MS).toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): number {
  const a = parseDate(from);
  const b = parseDate(to);
  return Math.round((Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / DAY_MS);
}

/** Day/month placed into `year`, 29 February clamped to 28 February in non-leap years. */
export function dateInYear(year: number, day: number, month: number): string {
  return formatDate(year, month, Math.min(day, daysInMonth(year, month)));
}
