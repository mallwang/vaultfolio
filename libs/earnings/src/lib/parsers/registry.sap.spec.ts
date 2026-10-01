import {
  SAP_AUG_2026,
  SAP_AUG_2026_NET_OFF,
  SAP_SEP_2026_WITH_CORRECTION,
  UNRELATED_PAGES,
} from '../testing/sap-entgeltnachweis.fixtures';
import { textDocument } from './pdf-text';
import { parseDocument } from './registry';

describe('parseDocument with the SAP parser', () => {
  it('parses and checks a valid payslip', () => {
    const result = parseDocument(textDocument(SAP_SEP_2026_WITH_CORRECTION.pages));
    expect(result).toMatchObject({
      ok: true,
      parserId: 'sap-entgeltnachweis',
      parserVersion: '1.0.0',
      documentType: 'PAYSLIP',
    });
    expect(parseDocument(textDocument(SAP_AUG_2026.pages)).ok).toBe(true);
  });

  it('rejects the net-off payslip with CHECK_FAILED naming check, period and difference', () => {
    expect(parseDocument(textDocument(SAP_AUG_2026_NET_OFF.pages))).toEqual({
      ok: false,
      error: {
        code: 'CHECK_FAILED',
        params: { check: 'NET', period: '2026-08', difference: '12.40' },
      },
      parserId: 'sap-entgeltnachweis',
      parserVersion: '1.0.0',
      documentType: 'PAYSLIP',
    });
  });

  it('rejects unrelated text as UNSUPPORTED_FORMAT', () => {
    expect(parseDocument(textDocument(UNRELATED_PAGES))).toEqual({
      ok: false,
      error: { code: 'UNSUPPORTED_FORMAT' },
    });
  });
});
