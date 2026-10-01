import {
  BWE_FIXTURES,
  BWE_JAN_2011_TWO_STATEMENTS,
  BWE_MAR_2011,
  BWE_PERSONAL_DATA,
} from '../testing/bundeswehr-wehrsoldabrechnung.fixtures';
import { SAP_AUG_2026, UNRELATED_PAGES } from '../testing/sap-entgeltnachweis.fixtures';
import { bundeswehrWehrsoldabrechnungParser as parser } from './bundeswehr-wehrsoldabrechnung';
import { type PdfDocumentText, type PdfLine, textDocument } from './pdf-text';

const AMOUNT = /^-?[\d.]+,\d{2}$/;

function cell(words: string[], x0: number, y: number): PdfLine[] {
  if (words.length === 0) return [];
  return [
    {
      text: words.join(' '),
      y,
      words: words.map((w, k) => ({ text: w, x: x0 + k * 40, width: 30 })),
    },
  ];
}

function skewedLine(text: string, y: number): PdfLine[] {
  const words = text.split(' ');
  if (/^Wehrsoldabrechnungsbeleg \S+ \d{4}$/.test(text)) {
    return [...cell(words.slice(2), 420, y + 2), ...cell(words.slice(0, 2), 50, y)];
  }
  const amounts = words.filter((w) => AMOUNT.test(w));
  if (!/^(\d{2}\.\d{4}|Summe|Auszahlungsbetrag)/.test(text) || amounts.length === 0) {
    return cell(words, 50, y);
  }
  const label = words.filter((w) => !AMOUNT.test(w));
  return [...cell(amounts, 400, y + 5), ...cell(label, 50, y)];
}

/**
 * The scan layout: label and amounts of a row are separate lines, the amounts 5 points higher; the
 * year of the header sits 2 points off. Lines run top to bottom with falling y, as in a real PDF.
 */
function skewed(pages: string[][]): PdfDocumentText {
  return {
    pages: pages.map((lines) => ({ lines: lines.flatMap((t, i) => skewedLine(t, 800 - i * 12)) })),
  };
}

describe('bundeswehr-wehrsoldabrechnung parser', () => {
  it('identifies itself', () => {
    expect(parser).toMatchObject({
      id: 'bundeswehr-wehrsoldabrechnung',
      version: '1.0.0',
      documentType: 'PAYSLIP',
    });
  });

  it.each(BWE_FIXTURES.filter((f) => 'records' in f.expected).map((f) => [f.fileName, f] as const))(
    'reads every field of %s exactly',
    (_name, fixture) => {
      expect(parser.parse(textDocument(fixture.pages))).toEqual({
        ok: true,
        employer: 'Bundeswehr',
        records: (fixture.expected as { records: unknown[] }).records,
        certificates: [],
      });
    },
  );

  it.each(BWE_FIXTURES.filter((f) => 'error' in f.expected).map((f) => [f.fileName, f] as const))(
    'rejects %s with its error',
    (_name, fixture) => {
      expect(parser.parse(textDocument(fixture.pages))).toEqual({
        ok: false,
        error: (fixture.expected as { error: unknown }).error,
      });
    },
  );

  it('merges the statements of one issue month into one payslip', () => {
    const outcome = parser.parse(textDocument(BWE_JAN_2011_TWO_STATEMENTS.pages));
    if (!outcome.ok) throw new Error('expected success');
    expect(outcome.records).toHaveLength(2);
    expect(outcome.records.filter((r) => r.amounts.payout !== null)).toHaveLength(1);
  });

  it('reports tax and social-security fields as zero', () => {
    const outcome = parser.parse(textDocument(BWE_MAR_2011.pages));
    if (!outcome.ok) throw new Error('expected success');
    expect(outcome.records[0].amounts).toMatchObject({
      taxGross: '0.00',
      svGrossKv: '0.00',
      svGrossRv: '0.00',
      wageTax: '0.00',
      health: '0.00',
    });
  });

  it('never puts a personal identifier into the outcome', () => {
    for (const fixture of BWE_FIXTURES) {
      const serialized = JSON.stringify(parser.parse(textDocument(fixture.pages)));
      for (const secret of BWE_PERSONAL_DATA) expect(serialized).not.toContain(secret);
    }
  });

  it('detects statements only', () => {
    expect(parser.detect(textDocument(BWE_MAR_2011.pages))).toBe(true);
    expect(parser.detect(textDocument(SAP_AUG_2026.pages))).toBe(false);
    expect(parser.detect(textDocument(UNRELATED_PAGES))).toBe(false);
  });

  it('reads a scan whose label and amounts sit on separate, skewed lines', () => {
    expect(parser.parse(skewed(BWE_MAR_2011.pages))).toEqual({
      ok: true,
      employer: 'Bundeswehr',
      records: (BWE_MAR_2011.expected as { records: unknown[] }).records,
      certificates: [],
    });
  });

  it('takes the issue month of a statement without a readable header month from the file', () => {
    const [first, second] = BWE_JAN_2011_TWO_STATEMENTS.pages;
    const unreadable = second.map((l) =>
      l.startsWith('Wehrsoldabrechnungsbeleg') ? 'Wehrsoldabrechnungsbeleg' : l,
    );
    expect(parser.parse(textDocument([first, unreadable]))).toEqual({
      ok: true,
      employer: 'Bundeswehr',
      records: (BWE_JAN_2011_TWO_STATEMENTS.expected as { records: unknown[] }).records,
      certificates: [],
    });
  });

  it('fails with MISSING_FIELD when a page carries no readable month', () => {
    const pages = [['Wehrsoldabrechnungsbeleg Xyz 2011', 'Auszahlungsbetrag 1,00']];
    expect(parser.parse(textDocument(pages))).toEqual({
      ok: false,
      error: { code: 'MISSING_FIELD', params: { field: 'statementMonth' } },
    });
  });
});
