import {
  BBK_DEC_2025_BONUS,
  BBK_FEB_2025_CORRECTION,
  BBK_FIXTURES,
  BBK_MAR_2025,
  BBK_MAR_2025_NET_OFF,
  BBK_PERSONAL_DATA,
} from '../testing/bundesbank-verdienstabrechnung.fixtures';
import { SAP_AUG_2026, UNRELATED_PAGES } from '../testing/sap-entgeltnachweis.fixtures';
import { bundesbankVerdienstabrechnungParser as parser } from './bundesbank-verdienstabrechnung';
import { textDocument } from './pdf-text';

describe('bundesbank-verdienstabrechnung parser', () => {
  it('identifies itself', () => {
    expect(parser).toMatchObject({
      id: 'bundesbank-verdienstabrechnung',
      version: '1.0.0',
      documentType: 'PAYSLIP',
    });
  });

  it.each(BBK_FIXTURES.filter((f) => 'records' in f.expected).map((f) => [f.fileName, f] as const))(
    'reads every field of %s exactly',
    (_name, fixture) => {
      expect(parser.parse(fixture.document)).toEqual({
        ok: true,
        employer: 'Deutsche Bundesbank',
        records: (fixture.expected as { records: unknown[] }).records,
        certificates: [],
      });
    },
  );

  it('reads cents without decimal separator, thousands dots and trailing minus', () => {
    const outcome = parser.parse(BBK_MAR_2025.document);
    if (!outcome.ok) throw new Error('expected success');
    // `3.15000`-style Betrag column vs. formatted EBV column vs. `29000-` deductions
    expect(outcome.records[0].amounts).toMatchObject({
      gross: '3170.00',
      health: '290.00',
      wageTax: '300.00',
    });
  });

  it('derives other from the lines so the PAYOUT check can fail independently', () => {
    const outcome = parser.parse(BBK_MAR_2025.document);
    if (!outcome.ok) throw new Error('expected success');
    const { net, other, payout } = outcome.records[0].amounts;
    expect([net, other, payout]).toEqual(['2155.00', '-190.00', '1965.00']);
  });

  it('puts the tax of one-off pay into the one-off part only', () => {
    const outcome = parser.parse(BBK_DEC_2025_BONUS.document);
    if (!outcome.ok) throw new Error('expected success');
    const { wageTax, oneOff } = outcome.records[0].amounts;
    expect(wageTax).toBe('520.00');
    expect(oneOff.wageTax).toBe('220.00');
  });

  it('takes period and issued from the header of a correction', () => {
    const outcome = parser.parse(BBK_FEB_2025_CORRECTION.document);
    if (!outcome.ok) throw new Error('expected success');
    const [record] = outcome.records;
    expect([record.period, record.issued, record.kind, record.seq]).toEqual([
      '2025-02',
      '2025-03',
      'CORRECTION',
      2,
    ]);
    expect(record.amounts.payout).toBeNull();
    expect(record.amounts.ytd).toBeNull();
  });

  it('keeps the net-off statement readable (the NET check rejects it, not the parser)', () => {
    const outcome = parser.parse(BBK_MAR_2025_NET_OFF.document);
    expect(outcome.ok && outcome.records[0].amounts.net).toBe('2167.40');
  });

  it('never emits letterhead personal data', () => {
    for (const fixture of BBK_FIXTURES) {
      const json = JSON.stringify(parser.parse(fixture.document));
      for (const secret of BBK_PERSONAL_DATA) expect(json).not.toContain(secret);
    }
  });

  it('rejects a statement without header month as MISSING_FIELD', () => {
    const document = {
      pages: BBK_MAR_2025.document.pages.map((p) => ({
        lines: p.lines.filter((l) => !l.text.includes('Z E N T R A L E')),
      })),
    };
    expect(parser.parse(document)).toEqual({
      ok: false,
      error: { code: 'MISSING_FIELD', params: { field: 'statementMonth' } },
    });
  });

  it('rejects a regular statement without its net line as MISSING_FIELD', () => {
    const document = {
      pages: BBK_MAR_2025.document.pages.map((p) => ({
        lines: p.lines.filter((l) => !l.text.startsWith('N e t t o E B V')),
      })),
    };
    expect(parser.parse(document)).toEqual({
      ok: false,
      error: { code: 'MISSING_FIELD', params: { field: 'net', period: '2025-03' } },
    });
  });

  it('tolerates OCR noise: a dropped Z of "Zahlbrutto" and a foreign character as decimal comma in the table', () => {
    const noisy = {
      pages: BBK_FEB_2025_CORRECTION.document.pages.map((p) => ({
        lines: p.lines.map((l) => {
          const table = /^[LEAJ]/.test(l.text) && l.text.includes(', 0 0');
          const words = l.words
            .filter((w, i) => !(l.text.startsWith('Z a h l') && i === 0 && w.text === 'Z'))
            .map((w) => (table && w.text === ',' ? { ...w, text: '‚' } : w));
          return { ...l, words, text: words.map((w) => w.text).join(' ') };
        }),
      })),
    };
    expect(noisy.pages[0].lines.some((l) => l.text.includes('‚'))).toBe(true);
    expect(parser.detect(noisy)).toBe(true);
    expect(parser.parse(noisy)).toEqual(parser.parse(BBK_FEB_2025_CORRECTION.document));
  });

  it('detects Bundesbank statements only', () => {
    expect(BBK_FIXTURES.every((f) => parser.detect(f.document))).toBe(true);
    expect(parser.detect(textDocument(SAP_AUG_2026.pages))).toBe(false);
    expect(parser.detect(textDocument(UNRELATED_PAGES))).toBe(false);
  });
});
