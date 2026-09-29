import { type Money, normalizeEmployerName, toMoney } from '../model';

/** Output of the browser PDF adapter (libs/frontend/domain/earnings), input of every parser. */
export interface PdfDocumentText {
  pages: PdfPageText[];
}

export interface PdfPageText {
  /** Top to bottom. */
  lines: PdfLine[];
}

export interface PdfWord {
  text: string;
  x: number;
  width: number;
}

export interface PdfLine {
  /** Words joined by single spaces. */
  text: string;
  /** Left to right, for column-sensitive parsing. */
  words: PdfWord[];
  y: number;
}

/** German amount: `1.234,56`, optionally signed `-5,63` or trailing-minus `591,70-`. */
const GERMAN_AMOUNT = /(?<![\d.])(-?)(\d[\d.]*),(\d{2})(-)?/;
/** Every German amount of a line; a trailing `-` counts only when not followed by an uppercase letter (`12,00-E`). */
const GERMAN_AMOUNTS = /(?<![\d,.])-?(?:\d{1,3}(?:\.\d{3})+|\d+),\d{2}(?:-(?![A-ZÄÖÜ]))?/g;
/** Hours/days quantities printed next to amounts, e.g. `8,00 S`, `21,00 T`, `160,00 H`. */
const QUANTITY = /(?<!\d)\d+,\d{2}(?: ?-)? ?[STH]\b/g;

/** Converts a German amount to a canonical money string; `null` when `text` holds none. */
export function parseGermanAmount(text: string): Money | null {
  const m = GERMAN_AMOUNT.exec(text);
  if (!m) return null;
  const negative = m[1] === '-' || m[4] === '-';
  const value = `${negative ? '-' : ''}${m[2].replace(/\./g, '')}.${m[3]}`;
  return toMoney(value);
}

/** All money amounts of a text, left to right, quantities (hours/days) removed. */
export function amountsIn(text: string): Money[] {
  const cleaned = text.replace(QUANTITY, ' ');
  return [...cleaned.matchAll(GERMAN_AMOUNTS)].map((m) => parseGermanAmount(m[0]) as Money);
}

/** Text before the first amount (the line's label). */
export function labelOf(text: string): string {
  const cleaned = text.replace(QUANTITY, ' ');
  GERMAN_AMOUNTS.lastIndex = 0;
  const idx = cleaned.search(GERMAN_AMOUNTS);
  return (idx < 0 ? cleaned : cleaned.slice(0, idx)).trim();
}

export function allLines(doc: PdfDocumentText): PdfLine[] {
  return doc.pages.flatMap((p) => p.lines);
}

export function documentText(doc: PdfDocumentText): string {
  return doc.pages.map((p) => p.lines.map((l) => l.text).join('\n')).join('\n');
}

/** First line whose text matches `label` (a regex or a substring). */
export function findLine(doc: PdfDocumentText, label: RegExp | string): PdfLine | undefined {
  return allLines(doc).find((l) =>
    typeof label === 'string' ? l.text.includes(label) : label.test(l.text),
  );
}

/**
 * The amount printed in the column that contains `x` (a word whose horizontal extent covers `x`,
 * with `tolerance` points of slack), or `null` when that column is empty.
 */
export function amountAtColumn(line: PdfLine, x: number, tolerance = 2): Money | null {
  const word = line.words.find((w) => x >= w.x - tolerance && x <= w.x + w.width + tolerance);
  return word ? parseGermanAmount(word.text) : null;
}

/** Builds a line from plain text (words split at spaces, evenly spaced) — for fixtures and tests. */
export function textLine(text: string, y = 0): PdfLine {
  let x = 0;
  const words = text
    .split(' ')
    .filter((w) => w.length > 0)
    .map((w) => {
      const word = { text: w, x, width: w.length * 5 };
      x += word.width + 5;
      return word;
    });
  return { text: words.map((w) => w.text).join(' '), words, y };
}

/** Builds a document from pages of plain-text lines — for fixtures and tests. */
export function textDocument(pages: string[][]): PdfDocumentText {
  return { pages: pages.map((lines) => ({ lines: lines.map((t, i) => textLine(t, i * 12)) })) };
}

const LEGAL_FORM = /\b(?:GmbH & Co\. KG|GmbH|AG|SE|KGaA|KG|OHG|UG|mbH|e\.\s?V\.)(?=$|[\s,·|])/;

/**
 * Employer name from document lines: the first line naming a legal entity (GmbH, AG, SE, …), cut
 * after the legal form and before an address separator (` · `, ` | `, `,`). Shared by every parser
 * so a payslip and a certificate of one employer resolve to the same detected name (FR-020).
 */
export function employerFromLines(lines: readonly string[]): string | null {
  for (const line of lines) {
    const m = LEGAL_FORM.exec(line);
    if (m) {
      const name = line.slice(0, m.index + m[0].length).split(/\s[·|]\s|,/)[0];
      return normalizeEmployerName(name) || null;
    }
  }
  return null;
}
