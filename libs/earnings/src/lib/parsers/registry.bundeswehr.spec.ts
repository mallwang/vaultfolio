import {
  BWE_MAR_2011,
  BWE_MAR_2011_PAYOUT_OFF,
} from '../testing/bundeswehr-wehrsoldabrechnung.fixtures';
import { BBK_MAR_2025 } from '../testing/bundesbank-verdienstabrechnung.fixtures';
import { SAP_AUG_2026 } from '../testing/sap-entgeltnachweis.fixtures';
import { textDocument } from './pdf-text';
import { parseDocument } from './registry';

const IDENTITY = {
  parserId: 'bundeswehr-wehrsoldabrechnung',
  parserVersion: '1.0.0',
  documentType: 'PAYSLIP',
};

describe('parseDocument with the Bundeswehr parser', () => {
  it('parses and checks a statement with corrections', () => {
    expect(parseDocument(textDocument(BWE_MAR_2011.pages))).toMatchObject({
      ok: true,
      employer: 'Bundeswehr',
      ...IDENTITY,
    });
  });

  it('rejects a wrong payout with CHECK_FAILED', () => {
    expect(parseDocument(textDocument(BWE_MAR_2011_PAYOUT_OFF.pages))).toEqual({
      ok: false,
      error: {
        code: 'CHECK_FAILED',
        params: { check: 'PAYOUT', period: '2011-03', difference: '10.00' },
      },
      ...IDENTITY,
    });
  });

  it('still routes SAP and Bundesbank statements to their parsers', () => {
    expect(parseDocument(textDocument(SAP_AUG_2026.pages))).toMatchObject({
      parserId: 'sap-entgeltnachweis',
    });
    expect(parseDocument(BBK_MAR_2025.document)).toMatchObject({
      parserId: 'bundesbank-verdienstabrechnung',
    });
  });
});
