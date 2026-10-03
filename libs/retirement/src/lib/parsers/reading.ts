import {
  type PdfDocumentText,
  allLines,
  amountsIn,
  normaliseRecognisedWord,
} from '@vaultfolio/document-text';

const DATE = /(\d{2})\.(\d{2})\.(\d{4})/;
const PERCENT = /(\d{1,3}(?:,\d{1,4})?)\s?%/;
const DECIMAL = /(?<![\d.,])(\d{1,3}(?:\.\d{3})*|\d+),(\d{1,4})(?![\d,])/;

/** Text of every line, top to bottom; digits of recognised (scanned) text are normalised first. */
export function readLines(doc: PdfDocumentText): string[] {
  const recognised = doc.origin === 'RECOGNISED';
  return allLines(doc).map((line) =>
    recognised && line.words.length > 0
      ? line.words.map((w) => normaliseRecognisedWord(w.text)).join(' ')
      : line.text,
  );
}

/** Index of the first line matching `label`, or `-1`. */
export function indexOfLabel(lines: readonly string[], label: RegExp, from = 0): number {
  for (let i = from; i < lines.length; i++) if (label.test(lines[i])) return i;
  return -1;
}

/** The part of the line after the first match of `label` (the whole line when it has none). */
function afterLabel(line: string, label: RegExp): string {
  const m = label.exec(line);
  return m ? line.slice(m.index + m[0].length) : line;
}

/**
 * Text belonging to a label: what follows it on its line, or — when that holds nothing of the
 * wanted kind — the next line if it is a bare value (no further words).
 */
function valueText(
  lines: readonly string[],
  label: RegExp,
  has: (text: string) => boolean,
): string | undefined {
  const i = indexOfLabel(lines, label);
  if (i < 0) return undefined;
  const same = afterLabel(lines[i], label);
  if (has(same)) return same;
  const next = lines[i + 1];
  return next !== undefined && has(next) && !/[A-Za-zÄÖÜäöüß]{4,}/.test(next) ? next : undefined;
}

/** First money amount after `label` (same line, or a bare amount on the next line). */
export function amountAfter(lines: readonly string[], label: RegExp): string | undefined {
  const text = valueText(lines, label, (t) => amountsIn(t).length > 0);
  return text === undefined ? undefined : amountsIn(text)[0];
}

/** All money amounts after `label` on its line. */
export function amountsAfter(lines: readonly string[], label: RegExp): string[] {
  const i = indexOfLabel(lines, label);
  return i < 0 ? [] : amountsIn(afterLabel(lines[i], label));
}

/** Converts `dd.mm.yyyy` into `YYYY-MM-DD`; `undefined` for anything that is not a real date. */
export function isoDate(day: string, month: string, year: string): string | undefined {
  const iso = `${year}-${month}-${day}`;
  const d = new Date(`${iso}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso ? iso : undefined;
}

/** First valid date after `label`. */
export function dateAfter(lines: readonly string[], label: RegExp): string | undefined {
  const text = valueText(lines, label, (t) => dateIn(t) !== undefined);
  return text === undefined ? undefined : dateIn(text);
}

export function dateIn(text: string): string | undefined {
  const m = DATE.exec(text);
  return m ? isoDate(m[1], m[2], m[3]) : undefined;
}

/** Every valid date of `text`, left to right. */
export function datesIn(text: string): string[] {
  return [...text.matchAll(new RegExp(DATE, 'g'))]
    .map((m) => isoDate(m[1], m[2], m[3]))
    .filter((d): d is string => d !== undefined);
}

/** First `n,nnnn` decimal after `label` as a canonical dot-decimal string (`28,5000` → `28.5000`). */
export function decimalAfter(lines: readonly string[], label: RegExp): string | undefined {
  const text = valueText(lines, label, (t) => DECIMAL.test(t));
  const m = text === undefined ? null : DECIMAL.exec(text);
  return m ? `${m[1].replaceAll('.', '')}.${m[2]}` : undefined;
}

/** First percentage after `label` as a dot-decimal string (`1,25 %` → `1.2500`). */
export function percentAfter(lines: readonly string[], label: RegExp): string | undefined {
  const text = valueText(lines, label, (t) => PERCENT.test(t));
  const m = text === undefined ? null : PERCENT.exec(text);
  if (!m) return undefined;
  const [whole, fraction = ''] = m[1].split(',');
  return `${whole}.${fraction.padEnd(4, '0')}`;
}

/** Trimmed text after `label` on its line (labelled free text such as a provider name). */
export function textAfter(lines: readonly string[], label: RegExp): string | undefined {
  const i = indexOfLabel(lines, label);
  if (i < 0) return undefined;
  const text = afterLabel(lines[i], label)
    .replace(/^[\s:–-]+/, '')
    .trim();
  return text === '' ? undefined : text;
}

/** Reduces `figures` to its present entries (parsers leave out what they did not find). */
export function present<T extends object>(figures: T): T {
  return Object.fromEntries(Object.entries(figures).filter(([, v]) => v !== undefined)) as T;
}
