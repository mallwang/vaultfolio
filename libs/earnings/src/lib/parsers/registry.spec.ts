import type { ParseOutcome } from '../model';
import { payRecord } from '../testing/builders';
import { textDocument } from './pdf-text';
import { collectCheckFailures, editableKeys } from '../checks';
import { applyCorrection } from '../corrections';
import { evaluateChecks } from '../checks';
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
      partial: {
        employer: off.ok ? off.employer : '',
        records: off.ok ? off.records : [],
        certificates: [],
      },
      parserId: 'a',
      parserVersion: '1.0.0',
      documentType: 'PAYSLIP',
    });
  });

  it('carries no partial for any other error', () => {
    const failing = stub('a', 'Payslip', { ok: false, error: { code: 'MISSING_FIELD' } });
    expect(parseDocument(textDocument([['Payslip']]), [failing])).not.toHaveProperty('partial');
    expect(parseDocument(textDocument([['x']]), [failing])).not.toHaveProperty('partial');
  });

  it('lets a corrected partial pass the checks', () => {
    const off: ParseOutcome = {
      ...good,
      records: [payRecord({ amounts: { net: '3192.40', payout: '3192.40' } })],
    };
    const result = parseDocument(textDocument([['Payslip']]), [stub('a', 'Payslip', off)]);
    if (result.ok || !result.partial) throw new Error('expected a partial result');
    const editable = editableKeys(collectCheckFailures(result.partial.records));
    let records = applyCorrection(
      result.partial.records,
      { recordIndex: 0, key: 'net', value: '3180.00' },
      editable,
    );
    records = applyCorrection(
      records ?? [],
      { recordIndex: 0, key: 'payout', value: '3180.00' },
      editable,
    );
    expect(evaluateChecks(records ?? []).failure).toBeNull();
  });
});
