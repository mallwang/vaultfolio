import { amountsIn, labelOf, type PdfDocumentText } from '../parsers/pdf-text.js';
import { BBK_FIXTURES } from '../testing/bundesbank-verdienstabrechnung.fixtures.js';
import { BWE_FIXTURES } from '../testing/bundeswehr-wehrsoldabrechnung.fixtures.js';
import { CERTIFICATE_FIXTURES } from '../testing/lohnsteuerbescheinigung.fixtures.js';
import * as sap from '../testing/sap-entgeltnachweis.fixtures.js';
import { isKnownLabel, LABEL_VOCABULARY, normalizeLabelWord } from './label-vocabulary.js';

function textDoc(pages: string[][]): PdfDocumentText {
  return { pages: pages.map((p) => ({ lines: p.map((text) => ({ text, words: [], y: 0 })) })) };
}

const SAP_FIXTURES = Object.values(sap).filter(
  (value): value is sap.SapFixture =>
    typeof value === 'object' && value !== null && 'pages' in value && 'fileName' in value,
);

const DOCUMENTS: PdfDocumentText[] = [
  ...SAP_FIXTURES.map((f) => textDoc(f.pages)),
  ...BWE_FIXTURES.map((f) => textDoc(f.pages)),
  ...CERTIFICATE_FIXTURES.map((f) => textDoc(f.pages)),
  ...BBK_FIXTURES.map((f) => f.document),
];

const isPlainWord = (word: string): boolean => {
  const normalized = normalizeLabelWord(word);
  return /^\p{L}[\p{L}/-]{2,}$/u.test(normalized) && !normalized.endsWith('-');
};

function labelWordsOf(line: { text: string }): string[] {
  if (amountsIn(line.text).length === 0) return [];
  return labelOf(line.text).split(/\s+/).filter(isPlainWord);
}

/** Label words of every line that carries an amount — what the existing parsers read next to a figure. */
function parserLabelWords(): string[] {
  const lines = DOCUMENTS.flatMap((doc) => doc.pages.flatMap((page) => page.lines));
  return [...new Set(lines.flatMap(labelWordsOf))].sort();
}

describe('label vocabulary', () => {
  it('keeps every label printed next to a figure in the parsers’ fixtures', () => {
    const words = parserLabelWords();
    expect(words.length).toBeGreaterThan(30);
    expect(words.filter((word) => !isKnownLabel(word))).toEqual([]);
  });

  it('keeps common German payroll terms', () => {
    for (const word of [
      'Brutto',
      'Netto',
      'Lohnsteuer',
      'Solidaritätszuschlag',
      'Kirchensteuer',
      'Krankenversicherung',
      'Pflegeversicherung',
      'Rentenversicherung',
      'Arbeitslosenversicherung',
      'Auszahlungsbetrag',
    ]) {
      expect(isKnownLabel(word)).toBe(true);
    }
  });

  it('normalises case and surrounding punctuation', () => {
    expect(isKnownLabel('LOHNSTEUER')).toBe(true);
    expect(isKnownLabel('Lohnsteuer:')).toBe(true);
    expect(isKnownLabel('(Netto)')).toBe(true);
    expect(isKnownLabel('Netto,')).toBe(true);
  });

  it('does not keep names, unknown words, values or empty input', () => {
    for (const word of [
      'Mustermann',
      'Erika',
      'Hafenstraße',
      'Brightline',
      'Netto1',
      '123',
      '',
      ':',
    ]) {
      expect(isKnownLabel(word)).toBe(false);
    }
  });

  it('is stored normalised, alphabetically and without digits', () => {
    const entries = [...LABEL_VOCABULARY];
    expect(entries.every((entry) => entry === normalizeLabelWord(entry) && !/\d/.test(entry))).toBe(
      true,
    );
    expect(entries).toEqual([...entries].sort((a, b) => a.localeCompare(b, 'de')));
  });
});
