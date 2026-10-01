import { toImportFile } from './import-file';
import { certificate, payRecord } from './testing/builders';
import { validateImportFile } from './validation';

const META = {
  clientFileId: 'f1',
  fileName: '2026_09_Entgeltnachweis.pdf',
  sourceType: 'PAYSLIP_PDF' as const,
  fileSha256: 'b'.repeat(64),
  parserId: 'sap-entgeltnachweis',
  parserVersion: '1.0.0',
};

describe('toImportFile', () => {
  it('emits exactly the whitelisted keys, dropping anything extra', () => {
    const polluted = {
      ...payRecord(),
      items: ['Tarifgehalt'],
      amounts: { ...payRecord().amounts, notes: 'x', oneOff: { gross: '1.00', label: 'Bonus' } },
    } as never;
    const file = toImportFile(
      { records: [polluted], certificates: [{ ...certificate(), source: 'x' } as never] },
      {
        ...META,
        extra: 'x',
      } as never,
    );
    expect(Object.keys(file)).toEqual([
      'clientFileId',
      'fileName',
      'sourceType',
      'fileSha256',
      'parserId',
      'parserVersion',
      'records',
      'certificates',
    ]);
    expect(Object.keys(file.records[0])).toEqual([
      'employer',
      'period',
      'issued',
      'kind',
      'seq',
      'amounts',
    ]);
    expect(file.records[0].amounts.oneOff).toEqual({ gross: '1.00' });
    expect(JSON.stringify(file)).not.toMatch(/"(notes|items|label|source|extra)"/);
  });

  it('produces a body the server validation accepts', () => {
    const file = toImportFile({ records: [payRecord()], certificates: [] }, META);
    expect(validateImportFile(JSON.parse(JSON.stringify(file))).ok).toBe(true);
  });

  it('carries the names of corrected figures through and nothing else new', () => {
    const file = toImportFile(
      {
        records: [{ ...payRecord(), corrected: ['net', 'payout'] }, payRecord({ seq: 2 })],
        certificates: [],
      },
      META,
    );
    expect(Object.keys(file.records[0])).toEqual([
      'employer',
      'period',
      'issued',
      'kind',
      'seq',
      'amounts',
      'corrected',
    ]);
    expect(file.records[0].corrected).toEqual(['net', 'payout']);
    expect(file.records[1]).not.toHaveProperty('corrected');
    expect(validateImportFile(JSON.parse(JSON.stringify(file))).ok).toBe(true);
  });
});
