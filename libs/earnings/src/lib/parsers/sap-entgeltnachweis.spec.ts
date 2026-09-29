import {
  SAP_AUG_2026,
  SAP_AUG_2026_NET_OFF,
  SAP_AUG_2026_UNKNOWN_LINE,
  SAP_DEC_2025_BONUS,
  SAP_FIXTURES,
  SAP_MAR_2026_VOLUNTARY,
  SAP_OCT_2026_PAYOUT_ONLY,
  SAP_SEP_2026_WITH_CORRECTION,
  type SapFixture,
  UNRELATED_PAGES,
} from '../testing/sap-entgeltnachweis.fixtures';
import { textDocument } from './pdf-text';
import { sapEntgeltnachweisParser as parser } from './sap-entgeltnachweis';

function parse(fixture: SapFixture) {
  return parser.parse(textDocument(fixture.pages));
}

describe('sap-entgeltnachweis parser', () => {
  it('identifies itself', () => {
    expect(parser).toMatchObject({
      id: 'sap-entgeltnachweis',
      version: '1.0.0',
      documentType: 'PAYSLIP',
    });
  });

  it.each(SAP_FIXTURES.filter((f) => 'records' in f.expected).map((f) => [f.fileName, f] as const))(
    'reads every field of %s exactly',
    (_name, fixture) => {
      const outcome = parse(fixture);
      expect(outcome).toEqual({
        ok: true,
        employer: 'Brightline Software GmbH',
        records: (fixture.expected as { records: unknown[] }).records,
        certificates: [],
      });
    },
  );

  it('splits a statement into regular and correction records by period vs. issued', () => {
    const outcome = parse(SAP_SEP_2026_WITH_CORRECTION);
    if (!outcome.ok) throw new Error('expected success');
    expect(outcome.records.map((r) => [r.period, r.issued, r.kind, r.seq])).toEqual([
      ['2026-09', '2026-09', 'REGULAR', 1],
      ['2026-07', '2026-09', 'CORRECTION', 3],
    ]);
    // ytd only on the regular record, payout only on the statement's own month
    expect(outcome.records[0].amounts.ytd).not.toBeNull();
    expect(outcome.records[1].amounts.ytd).toBeNull();
    expect(outcome.records[1].amounts.payout).toBeNull();
    // other = payout − net per section
    expect(outcome.records[1].amounts.other).toBe('62.85');
  });

  it('continues a block across a page break', () => {
    const outcome = parse(SAP_SEP_2026_WITH_CORRECTION);
    if (!outcome.ok) throw new Error('expected success');
    // Pflege-/Renten-/Arbeitslosenversicherung are printed on page 2, after the GRUNDDATEN footer
    expect(outcome.records[0].amounts).toMatchObject({
      care: '93.60',
      pension: '483.60',
      unemployment: '67.60',
    });
  });

  it('counts the own share of voluntary health/care insurance and stores the subsidy', () => {
    const outcome = parse(SAP_MAR_2026_VOLUNTARY);
    if (!outcome.ok) throw new Error('expected success');
    expect(outcome.records[0].amounts).toMatchObject({
      health: '260.00',
      care: '55.00',
      net: '4323.00',
      other: '-40.00',
      employerSubsidy: { health: '260.00', care: '55.00' },
    });
  });

  it('splits one-off pay from regular pay', () => {
    const outcome = parse(SAP_DEC_2025_BONUS);
    if (!outcome.ok) throw new Error('expected success');
    expect(outcome.records[0].amounts.oneOff).toEqual({
      gross: '3000.00',
      taxGross: '3000.00',
      wageTax: '900.00',
      churchTax: '72.00',
    });
  });

  it('adds a PAYOUT_ONLY record when a statement only holds back-payments', () => {
    const outcome = parse(SAP_OCT_2026_PAYOUT_ONLY);
    if (!outcome.ok) throw new Error('expected success');
    expect(outcome.records.map((r) => r.kind)).toEqual(['CORRECTION', 'PAYOUT_ONLY']);
  });

  it('rejects an unknown statutory deduction line', () => {
    expect(parse(SAP_AUG_2026_UNKNOWN_LINE)).toEqual({
      ok: false,
      ...SAP_AUG_2026_UNKNOWN_LINE.expected,
    });
  });

  it('parses the net-off file (the check runs later in parseDocument)', () => {
    const outcome = parse(SAP_AUG_2026_NET_OFF);
    expect(outcome.ok && outcome.records[0].amounts.net).toBe('3128.40');
  });

  it('never reads personal identifiers into the output', () => {
    const json = JSON.stringify(parse(SAP_SEP_2026_WITH_CORRECTION));
    for (const identifier of [
      'Musterfrau',
      'Musterweg',
      '12345',
      '00012345',
      '345 678 901',
      '010180',
      'DE00',
      'Hafenstraße',
    ]) {
      expect(json).not.toContain(identifier);
    }
  });

  it('reports missing fields', () => {
    const noEmployer = { ...SAP_AUG_2026, pages: [SAP_AUG_2026.pages[0].slice(1)] };
    expect(parse(noEmployer)).toEqual({
      ok: false,
      error: { code: 'MISSING_FIELD', params: { field: 'employer' } },
    });
    const noNet = {
      ...SAP_AUG_2026,
      pages: [SAP_AUG_2026.pages[0].filter((l) => !l.startsWith('/55E'))],
    };
    expect(parse(noNet)).toEqual({
      ok: false,
      error: { code: 'MISSING_FIELD', params: { field: 'net', period: '2026-08' } },
    });
    const noSection = {
      ...SAP_AUG_2026,
      pages: [SAP_AUG_2026.pages[0].filter((l) => !l.startsWith('Abrechnungsdaten'))],
    };
    expect(parse(noSection)).toEqual({
      ok: false,
      error: { code: 'MISSING_FIELD', params: { field: 'section' } },
    });
  });

  it('detects only SAP statements', () => {
    expect(parser.detect(textDocument(SAP_AUG_2026.pages))).toBe(true);
    expect(parser.detect(textDocument(UNRELATED_PAGES))).toBe(false);
    expect(
      parser.detect(
        textDocument([['Lohnsteuerbescheinigung für 2025', '3. Bruttoarbeitslohn 60.000,00']]),
      ),
    ).toBe(false);
  });
});
