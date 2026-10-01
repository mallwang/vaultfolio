import { readEarningsExport } from './export-v1';
import { largeExport, validExport } from './testing/export-v1.fixtures';

function errorOf(json: unknown) {
  const out = readEarningsExport(json);
  if (out.ok) throw new Error('expected an error');
  return out.error;
}

/** Mutable view of a synthetic export, for tampering tests. */
interface ExportDoc {
  notes?: string;
  records: {
    source?: string;
    items?: unknown[];
    corrected?: string[];
    kind?: string;
    ytd?: Record<string, number>;
    amounts: Record<string, number>;
    one_off: Record<string, number>;
  }[];
  certificates: { amounts: Record<string, number> }[];
}

function doc_(): ExportDoc {
  return validExport() as unknown as ExportDoc;
}

describe('readEarningsExport', () => {
  it('maps a valid v1 export exactly', () => {
    const out = readEarningsExport(validExport());
    expect(out.parserId).toBe('earnings-export');
    expect(out.parserVersion).toBe('1');
    if (!out.ok) throw new Error(out.error.code);
    expect(out.employer).toBe('Deutsche Musterbank');
    expect(out.records[0]).toEqual({
      employer: 'Deutsche Musterbank',
      period: '2013-11',
      issued: '2013-11',
      kind: 'REGULAR',
      seq: 1,
      amounts: {
        gross: '4000.00',
        taxGross: '4000.00',
        svGrossKv: '4000.00',
        svGrossRv: '4000.00',
        wageTax: '600.00',
        soli: '30.00',
        churchTax: '48.00',
        health: '330.00',
        care: '41.00',
        pension: '378.00',
        unemployment: '60.00',
        net: '2513.00',
        other: '-20.00',
        payout: '2493.00',
        oneOff: { gross: '500.00', wageTax: '120.00' },
        employerSubsidy: { health: '0.00', care: '0.00' },
        ytd: { gross: '44000.00', taxGross: '44000.00', wageTax: '6600.00' },
      },
    });
    // negative cents, missing keys = 0.00, payout null
    expect(out.records[1]).toMatchObject({
      kind: 'CORRECTION',
      amounts: {
        gross: '-22.07',
        wageTax: '-5.63',
        health: '-1.72',
        care: '0.00',
        net: '-14.72',
        other: '14.72',
        payout: null,
        oneOff: {},
        employerSubsidy: null,
        ytd: null,
      },
    });
    expect(out.records[2]).toMatchObject({
      kind: 'PAYOUT_ONLY',
      amounts: { gross: '0.00', other: '150.00', payout: '150.00' },
    });
    expect(out.certificates).toEqual([
      {
        employer: 'Deutsche Musterbank',
        year: 2013,
        amounts: expect.objectContaining({
          grossWage: '44000.00',
          wageTax: '6600.00',
          pensionEmployee: '4158.00',
          soli: '0.00',
        }),
      },
    ]);
  });

  it.each([
    [{ version: 2 }, '2'],
    [{ schema: 'other' }, '1'],
    [{ version: '1' }, '1'],
  ])('rejects an unsupported schema/version (%p)', (patch, version) => {
    expect(errorOf({ ...validExport(), ...patch })).toEqual({
      code: 'EXPORT_UNSUPPORTED_VERSION',
      params: { version },
    });
  });

  it.each([
    ['top level', (d: ExportDoc) => (d.notes = 'x'), 'notes'],
    ['record', (d: ExportDoc) => (d.records[0].source = 'payslips/x.pdf'), 'records[0].source'],
    [
      'corrected (never part of the companion format)',
      (d: ExportDoc) => (d.records[0].corrected = ['net']),
      'records[0].corrected',
    ],
    ['record items', (d: ExportDoc) => (d.records[0].items = []), 'records[0].items'],
    ['amounts', (d: ExportDoc) => (d.records[0].amounts.iban = 1), 'records[0].amounts.iban'],
    ['one_off', (d: ExportDoc) => (d.records[0].one_off.net = 1), 'records[0].one_off.net'],
    [
      'certificate',
      (d: ExportDoc) => (d.certificates[0].amounts.reduced_gross = 1),
      'certificates[0].amounts.reduced_gross',
    ],
  ])('rejects an unknown field at %s', (_label, mutate, path) => {
    const doc = doc_();
    mutate(doc);
    expect(errorOf(doc)).toEqual({ code: 'EXPORT_UNKNOWN_FIELD', params: { path } });
  });

  it('neither requires nor emits corrected figures', () => {
    const out = readEarningsExport(validExport());
    if (!out.ok) throw new Error('expected a valid export');
    expect(out.records.some((r) => 'corrected' in r)).toBe(false);
  });

  it('rejects non-integer cents', () => {
    const doc = doc_();
    doc.records[0].amounts.gross = 4000.5;
    expect(errorOf(doc)).toEqual({
      code: 'INVALID_VALUE',
      params: { path: 'records[0].amounts.gross' },
    });
  });

  it('rejects an unknown kind and ytd on a non-regular record', () => {
    const doc = doc_();
    doc.records[1].kind = 'bonus';
    expect(errorOf(doc)).toEqual({ code: 'INVALID_VALUE', params: { path: 'records[1].kind' } });
    const doc2 = doc_();
    doc2.records[1].ytd = { gross: 1 };
    expect(errorOf(doc2)).toEqual({ code: 'INVALID_VALUE', params: { path: 'records[1].ytd' } });
  });

  it('rejects a record failing NET', () => {
    const doc = doc_();
    doc.records[0].amounts.net = 252540;
    doc.records[0].amounts.payout = 250540;
    expect(errorOf(doc)).toEqual({
      code: 'CHECK_FAILED',
      params: { check: 'NET', period: '2013-11', difference: '12.40' },
    });
  });

  it('checks the payout per (employer, issued) group', () => {
    const doc = doc_();
    doc.records[0].amounts.payout = 250000;
    expect(errorOf(doc)).toEqual({
      code: 'CHECK_FAILED',
      params: { check: 'PAYOUT', period: '2013-11', difference: '7.00' },
    });
  });

  it('reads a full-career export', () => {
    const out = readEarningsExport(largeExport(260));
    expect(out.ok && out.records).toHaveLength(260);
  });

  it('rejects non-objects', () => {
    expect(errorOf('x')).toEqual({ code: 'INVALID_VALUE', params: { path: '' } });
  });
});
