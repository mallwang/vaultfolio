import {
  CERTIFICATE_FIXTURES,
  LSTB_2025_BRIGHTLINE,
} from '../testing/lohnsteuerbescheinigung.fixtures';
import { SAP_AUG_2026 } from '../testing/sap-entgeltnachweis.fixtures';
import { lohnsteuerbescheinigungParser as parser } from './lohnsteuerbescheinigung';
import { textDocument } from './pdf-text';
import { PARSER_REGISTRY, parseDocument } from './registry';

describe('lohnsteuerbescheinigung parser', () => {
  it('identifies itself', () => {
    expect(parser).toMatchObject({
      id: 'lohnsteuerbescheinigung',
      version: '1.0.0',
      documentType: 'CERTIFICATE',
    });
  });

  it.each(CERTIFICATE_FIXTURES.map((f) => [f.fileName, f] as const))(
    'reads %s exactly',
    (_name, fixture) => {
      expect(parser.parse(textDocument(fixture.pages))).toEqual({
        ok: true,
        employer: fixture.expected.employer,
        records: [],
        certificates: [fixture.expected],
      });
    },
  );

  it('never reads identifiers', () => {
    const json = JSON.stringify(parser.parse(textDocument(LSTB_2025_BRIGHTLINE.pages)));
    for (const identifier of ['Musterfrau', 'MSTRERKA80A01', '345 678 901', 'Hafenstraße']) {
      expect(json).not.toContain(identifier);
    }
  });

  it('reports a missing year', () => {
    expect(
      parser.parse(textDocument([['Brightline Software GmbH', '3. Bruttoarbeitslohn 1,00']])),
    ).toEqual({
      ok: false,
      error: { code: 'MISSING_FIELD', params: { field: 'year' } },
    });
  });

  it('detects only certificates', () => {
    expect(parser.detect(textDocument(LSTB_2025_BRIGHTLINE.pages))).toBe(true);
    expect(parser.detect(textDocument(SAP_AUG_2026.pages))).toBe(false);
  });

  it('is registered before the SAP parser and parsed through parseDocument', () => {
    expect(PARSER_REGISTRY.map((p) => p.id)).toEqual([
      'lohnsteuerbescheinigung',
      'sap-entgeltnachweis',
      'bundesbank-verdienstabrechnung',
    ]);
    expect(parseDocument(textDocument(LSTB_2025_BRIGHTLINE.pages))).toMatchObject({
      ok: true,
      parserId: 'lohnsteuerbescheinigung',
      documentType: 'CERTIFICATE',
    });
  });
});
