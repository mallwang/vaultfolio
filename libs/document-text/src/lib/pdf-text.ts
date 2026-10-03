import { parseGermanAmount } from './amount-tokens';

/** Output of the browser PDF adapter (libs/frontend/document-reader), input of every parser. */
export interface PdfDocumentText {
  pages: PdfPageText[];
  /**
   * Where the text comes from: the PDF's own text layer (`EXTRACTED`, the default) or on-device
   * text recognition of a scan (`RECOGNISED`, 034). Parsers ignore it; downstream steps use it for
   * the double-check notice and the lenient personal-data scan.
   */
  origin?: 'EXTRACTED' | 'RECOGNISED';
}

export interface PdfPageText {
  /** Top to bottom. */
  lines: PdfLine[];
  /** Page size in points; set for recognised pages (the request sample needs it). */
  width?: number;
  height?: number;
}

export interface PdfWord {
  text: string;
  x: number;
  width: number;
  /** Glyph height in points; set for recognised words. */
  height?: number;
  /** Recognised with low confidence (034): shown underlined in the request preview. */
  lowConfidence?: boolean;
}

export interface PdfLine {
  /** Words joined by single spaces. */
  text: string;
  /** Left to right, for column-sensitive parsing. */
  words: PdfWord[];
  y: number;
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
export function amountAtColumn(line: PdfLine, x: number, tolerance = 2): string | null {
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
