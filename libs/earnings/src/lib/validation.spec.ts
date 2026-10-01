import { certificate, payRecord } from './testing/builders';
import { validateImportFile } from './validation';

const SHA = 'a'.repeat(64);

function file(overrides: Record<string, unknown> = {}) {
  return {
    clientFileId: 'f1',
    fileName: '2026_09_Entgeltnachweis.pdf',
    sourceType: 'PAYSLIP_PDF',
    fileSha256: SHA,
    parserId: 'sap-entgeltnachweis',
    parserVersion: '1.0.0',
    records: [payRecord()],
    certificates: [],
    ...overrides,
  };
}

function errorOf(input: unknown) {
  const out = validateImportFile(input);
  if (out.ok) throw new Error('expected a validation error');
  return out.error;
}

describe('validateImportFile', () => {
  it('accepts a valid file and returns a whitelisted copy', () => {
    const input = file({ records: [payRecord({ employer: '  Brightline   Software GmbH ' })] });
    const out = validateImportFile(input);
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.value.records[0].employer).toBe('Brightline Software GmbH');
      expect(out.value).not.toBe(input);
      expect(out.value.records[0].amounts.gross).toBe('5000.00');
    }
  });

  it.each([
    [{ ...file(), notes: 'x' }, 'notes'],
    [file({ records: [{ ...payRecord(), source: 'x' }] }), 'records[0].source'],
    [
      file({ records: [payRecord({ amounts: { items: [] } as never })] }),
      'records[0].amounts.items',
    ],
    [
      file({ records: [payRecord({ amounts: { oneOff: { bonus: '1.00' } as never } })] }),
      'records[0].amounts.oneOff.bonus',
    ],
    [
      file({
        records: [
          payRecord({
            amounts: { employerSubsidy: { health: '1.00', care: '1.00', x: '1' } as never },
          }),
        ],
      }),
      'records[0].amounts.employerSubsidy.x',
    ],
    [
      file({ records: [payRecord({ amounts: { ytd: { iban: '1.00' } as never } })] }),
      'records[0].amounts.ytd.iban',
    ],
  ])('rejects an unknown key at any depth (%#)', (input, path) => {
    expect(errorOf(input)).toEqual({ code: 'EARNINGS_UNKNOWN_FIELD', params: { path } });
  });

  it.each([
    ['2026-13', 'records[0].period'],
    ['26-09', 'records[0].period'],
    ['2026-9', 'records[0].period'],
  ])('rejects period %s', (period, path) => {
    expect(errorOf(file({ records: [payRecord({ period, issued: period })] }))).toEqual({
      code: 'INVALID_VALUE',
      params: { path },
    });
  });

  it('requires REGULAR ⇒ issued = period and CORRECTION ⇒ issued > period', () => {
    expect(errorOf(file({ records: [payRecord({ issued: '2026-10' })] }))).toEqual({
      code: 'INVALID_VALUE',
      params: { path: 'records[0].issued' },
    });
    expect(errorOf(file({ records: [payRecord({ kind: 'CORRECTION', seq: 2 })] }))).toEqual({
      code: 'INVALID_VALUE',
      params: { path: 'records[0].issued' },
    });
    const ok = validateImportFile(
      file({
        records: [
          payRecord({
            kind: 'CORRECTION',
            period: '2026-07',
            seq: 3,
            amounts: { payout: null, net: '3180.00' },
          }),
        ],
      }),
    );
    expect(ok.ok).toBe(true);
  });

  it.each(['1.5', '1,00', '1234567890.00', 12.5, null])('rejects amount %p', (gross) => {
    expect(errorOf(file({ records: [payRecord({ amounts: { gross: gross as never } })] }))).toEqual(
      {
        code: 'INVALID_VALUE',
        params: { path: 'records[0].amounts.gross' },
      },
    );
  });

  it('accepts negative amounts', () => {
    const r = payRecord({
      kind: 'CORRECTION',
      period: '2026-07',
      seq: 3,
      amounts: {
        gross: '-100.00',
        wageTax: '0.00',
        health: '0.00',
        care: '0.00',
        pension: '0.00',
        unemployment: '0.00',
        net: '-100.00',
        payout: null,
      },
    });
    expect(validateImportFile(file({ records: [r] })).ok).toBe(true);
  });

  it.each([
    ['A'.repeat(64), 'fileSha256'],
    ['abc', 'fileSha256'],
  ])('rejects sha256 %s', (fileSha256, path) => {
    expect(errorOf(file({ fileSha256 }))).toEqual({ code: 'INVALID_VALUE', params: { path } });
  });

  it.each(['a/b.pdf', 'a\\b.pdf', '', 'x'.repeat(256)])('rejects file name %p', (fileName) => {
    expect(errorOf(file({ fileName }))).toEqual({
      code: 'INVALID_VALUE',
      params: { path: 'fileName' },
    });
  });

  it('accepts a 255-character file name', () => {
    expect(validateImportFile(file({ fileName: 'x'.repeat(251) + '.pdf' })).ok).toBe(true);
  });

  it('limits a file to 2,000 records', () => {
    const records = Array.from({ length: 2001 }, (_, i) => payRecord({ seq: (i % 999) + 1 }));
    expect(errorOf(file({ records }))).toEqual({
      code: 'LIMIT_EXCEEDED',
      params: { path: 'records' },
    });
  });

  it('rejects duplicate identities inside one file', () => {
    expect(
      errorOf(file({ records: [payRecord(), payRecord({ amounts: { payout: null } })] })),
    ).toEqual({
      code: 'INVALID_VALUE',
      params: { path: 'records[1].seq' },
    });
  });

  it('validates certificates', () => {
    const ok = validateImportFile(
      file({
        sourceType: 'CERTIFICATE_PDF',
        parserId: 'lohnsteuerbescheinigung',
        records: [],
        certificates: [certificate()],
      }),
    );
    expect(ok.ok).toBe(true);
    const missing = certificate();
    delete (missing.amounts as Partial<typeof missing.amounts>).soli;
    expect(errorOf(file({ records: [], certificates: [missing] }))).toEqual({
      code: 'INVALID_VALUE',
      params: { path: 'certificates[0].amounts.soli' },
    });
    expect(
      errorOf(file({ records: [], certificates: [{ ...certificate(), taxId: '1' }] })),
    ).toEqual({
      code: 'EARNINGS_UNKNOWN_FIELD',
      params: { path: 'certificates[0].taxId' },
    });
    expect(errorOf(file({ records: [], certificates: [certificate({ year: 2025.5 })] }))).toEqual({
      code: 'INVALID_VALUE',
      params: { path: 'certificates[0].year' },
    });
  });

  it('rejects an empty file', () => {
    expect(errorOf(file({ records: [] }))).toEqual({
      code: 'INVALID_VALUE',
      params: { path: 'records' },
    });
  });

  it('rejects a failing NET check with period and difference', () => {
    const r = payRecord({
      period: '2026-08',
      issued: '2026-08',
      amounts: { net: '3192.40', payout: '3192.40' },
    });
    expect(errorOf(file({ records: [r] }))).toEqual({
      code: 'CHECK_FAILED',
      params: { check: 'NET', period: '2026-08', difference: '12.40' },
    });
  });

  it('rejects a failing PAYOUT check', () => {
    expect(errorOf(file({ records: [payRecord({ amounts: { payout: '3000.00' } })] }))).toEqual({
      code: 'CHECK_FAILED',
      params: { check: 'PAYOUT', period: '2026-09', difference: '-180.00' },
    });
  });

  it('rejects non-objects', () => {
    expect(errorOf(null)).toEqual({ code: 'INVALID_VALUE', params: { path: '' } });
    expect(errorOf([])).toEqual({ code: 'INVALID_VALUE', params: { path: '' } });
  });
});

describe('validateImportFile — corrected figures', () => {
  const fixed = (corrected: unknown) => file({ records: [{ ...payRecord(), corrected }] });

  it('accepts distinct editable names on a payslip PDF and keeps them', () => {
    const out = validateImportFile(fixed(['wageTax', 'net']));
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.value.records[0].corrected).toEqual(['wageTax', 'net']);
  });

  it('accepts a record without the marker', () => {
    const out = validateImportFile(file());
    expect(out.ok && out.value.records[0].corrected).toBeFalsy();
  });

  it.each([
    [['bogus'], 'records[0].corrected[0]'],
    [['net', 'net'], 'records[0].corrected[1]'],
    [['taxGross'], 'records[0].corrected[0]'],
    [['other'], 'records[0].corrected[0]'],
    ['net', 'records[0].corrected'],
    [[5], 'records[0].corrected[0]'],
  ])('rejects %j with INVALID_VALUE', (corrected, path) => {
    expect(errorOf(fixed(corrected))).toEqual({ code: 'INVALID_VALUE', params: { path } });
  });

  it.each(['CERTIFICATE_PDF', 'EXPORT_JSON'])('rejects the marker on %s', (sourceType) => {
    expect(errorOf({ ...fixed(['net']), sourceType })).toEqual({
      code: 'INVALID_VALUE',
      params: { path: 'records[0].corrected' },
    });
  });

  it('still rejects any other unknown field', () => {
    expect(errorOf(file({ records: [{ ...payRecord(), correction: [] }] }))).toEqual({
      code: 'EARNINGS_UNKNOWN_FIELD',
      params: { path: 'records[0].correction' },
    });
  });

  it('rejects a corrected record that still fails a check', () => {
    const bad = file({
      records: [
        {
          ...payRecord({ amounts: { net: '3162.00', payout: '3162.00' } }),
          corrected: ['wageTax'],
        },
      ],
    });
    expect(errorOf(bad)).toEqual({
      code: 'CHECK_FAILED',
      params: { check: 'NET', period: '2026-09', difference: '-18.00' },
    });
  });
});
