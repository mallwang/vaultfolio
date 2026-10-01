import type { ParseOutcome } from '../model';
import { payRecord } from '../testing/builders';
import { textDocument } from './pdf-text';
import { type EarningsParser, parseDocument } from './registry';

function stub(id: string, marker: string, outcome: ParseOutcome): EarningsParser {
  return {
    id,
    version: '1.0.0',
    documentType: 'PAYSLIP',
    detect: (doc) => doc.pages.some((p) => p.lines.some((l) => l.text.includes(marker))),
    parse: () => outcome,
  };
}

const good: ParseOutcome = {
  ok: true,
  employer: 'Brightline Software GmbH',
  records: [payRecord()],
  certificates: [],
};

describe('parseDocument', () => {
  it('returns UNSUPPORTED_FORMAT when no parser matches', () => {
    expect(parseDocument(textDocument([['Rechnung']]), [stub('a', 'Payslip', good)])).toEqual({
      ok: false,
      error: { code: 'UNSUPPORTED_FORMAT' },
    });
  });

  it('uses the first matching parser and attaches its identity', () => {
    const second = stub('b', 'Payslip', { ok: false, error: { code: 'MISSING_FIELD' } });
    const result = parseDocument(textDocument([['Payslip']]), [stub('a', 'Payslip', good), second]);
    expect(result).toEqual({
      ...good,
      parserId: 'a',
      parserVersion: '1.0.0',
      documentType: 'PAYSLIP',
    });
  });

  it('passes parser errors through with the parser identity', () => {
    const failing = stub('a', 'Payslip', {
      ok: false,
      error: { code: 'UNKNOWN_LINE', params: { label: 'X', period: '2026-09' } },
    });
    expect(parseDocument(textDocument([['Payslip']]), [failing])).toEqual({
      ok: false,
      error: { code: 'UNKNOWN_LINE', params: { label: 'X', period: '2026-09' } },
      parserId: 'a',
      parserVersion: '1.0.0',
      documentType: 'PAYSLIP',
    });
  });

  it('turns a failing check into CHECK_FAILED', () => {
    const off: ParseOutcome = {
      ...good,
      records: [payRecord({ amounts: { net: '3192.40', payout: '3192.40' } })],
    };
    expect(parseDocument(textDocument([['Payslip']]), [stub('a', 'Payslip', off)])).toEqual({
      ok: false,
      error: {
        code: 'CHECK_FAILED',
        params: { check: 'NET', period: '2026-09', difference: '12.40' },
      },
      parserId: 'a',
      parserVersion: '1.0.0',
      documentType: 'PAYSLIP',
    });
  });
});
