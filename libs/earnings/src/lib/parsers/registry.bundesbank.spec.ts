import {
  BBK_FEB_2025_CORRECTION,
  BBK_MAR_2025,
  BBK_MAR_2025_NET_OFF,
} from '../testing/bundesbank-verdienstabrechnung.fixtures';
import { SAP_AUG_2026 } from '../testing/sap-entgeltnachweis.fixtures';
import { textDocument } from './pdf-text';
import { parseDocument } from './registry';

const IDENTITY = {
  parserId: 'bundesbank-verdienstabrechnung',
  parserVersion: '1.0.0',
  documentType: 'PAYSLIP',
};

describe('parseDocument with the Bundesbank parser', () => {
  it('parses and checks a regular statement and a correction', () => {
    expect(parseDocument(BBK_MAR_2025.document)).toMatchObject({ ok: true, ...IDENTITY });
    expect(parseDocument(BBK_FEB_2025_CORRECTION.document)).toMatchObject({
      ok: true,
      ...IDENTITY,
    });
  });

  it('rejects the net-off statement with CHECK_FAILED naming check, period and difference', () => {
    expect(parseDocument(BBK_MAR_2025_NET_OFF.document)).toEqual({
      ok: false,
      error: {
        code: 'CHECK_FAILED',
        params: { check: 'NET', period: '2025-03', difference: '12.40' },
      },
      ...IDENTITY,
    });
  });

  it('still routes SAP statements to the SAP parser', () => {
    expect(parseDocument(textDocument(SAP_AUG_2026.pages))).toMatchObject({
      ok: true,
      parserId: 'sap-entgeltnachweis',
    });
  });
});
