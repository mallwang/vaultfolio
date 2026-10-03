import {
  DRV_EXPECTED,
  syntheticDrvRenteninformation,
  syntheticDrvRenteninformation2024,
  syntheticPrivateStatement,
} from '../testing/statements.fixtures';
import { drvRenteninformationParser } from './drv-renteninformation';

describe('drvRenteninformationParser', () => {
  it('detects the Renteninformation and nothing else', () => {
    expect(drvRenteninformationParser.detects(syntheticDrvRenteninformation())).toBe(true);
    expect(drvRenteninformationParser.detects(syntheticPrivateStatement())).toBe(false);
  });

  it('reads every FR-002 figure exactly', () => {
    const outcome = drvRenteninformationParser.parse(syntheticDrvRenteninformation());
    expect(outcome).toEqual({
      ok: true,
      parser: { id: 'drv-renteninformation', version: '1.0.0' },
      record: {
        contractType: 'STATUTORY_PENSION',
        statementDate: DRV_EXPECTED.statementDate,
        payoutStart: DRV_EXPECTED.payoutStart,
        identifier: DRV_EXPECTED.identifier,
        figures: {
          dataPeriodFrom: DRV_EXPECTED.dataPeriodFrom,
          dataPeriodTo: DRV_EXPECTED.dataPeriodTo,
          fullDisabilityMonthly: DRV_EXPECTED.fullDisabilityMonthly,
          accruedMonthly: DRV_EXPECTED.accruedMonthly,
          projectedMonthly: DRV_EXPECTED.projectedMonthly,
          projectedAt1Pct: DRV_EXPECTED.projectedAt1Pct,
          projectedAt2Pct: DRV_EXPECTED.projectedAt2Pct,
          earningsPoints: DRV_EXPECTED.earningsPoints,
          currentPensionValue: DRV_EXPECTED.currentPensionValue,
          contributionsOwn: DRV_EXPECTED.contributionsOwn,
          contributionsEmployer: DRV_EXPECTED.contributionsEmployer,
          contributionsPublic: DRV_EXPECTED.contributionsPublic,
        },
        missingSupplement: [],
      },
    });
  });

  it('reads the scanned rendition with the same figures after digit normalisation', () => {
    const scan = syntheticDrvRenteninformation('scanned');
    expect(scan.origin).toBe('RECOGNISED');
    expect(JSON.stringify(scan)).toContain('1.14O,OO');
    const outcome = drvRenteninformationParser.parse(scan);
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.record.figures).toMatchObject({
        accruedMonthly: DRV_EXPECTED.accruedMonthly,
        fullDisabilityMonthly: DRV_EXPECTED.fullDisabilityMonthly,
      });
    }
  });

  it('rejects a misread figure as INCONSISTENT and names the failed checks only', () => {
    expect(drvRenteninformationParser.parse(syntheticDrvRenteninformation('misread'))).toEqual({
      ok: false,
      error: 'INCONSISTENT',
      failedChecks: ['STATUTORY_POINTS_VALUE', 'STATUTORY_ORDER'],
    });
  });

  it('rejects a document with a missing required label as INCOMPLETE', () => {
    expect(
      drvRenteninformationParser.parse(syntheticDrvRenteninformation('missing-label')),
    ).toEqual({ ok: false, error: 'INCOMPLETE' });
  });

  it('reads the letter layout since 2024 (column amounts, page 2 text, whole-euro variants)', () => {
    const doc = syntheticDrvRenteninformation2024();
    expect(drvRenteninformationParser.detects(doc)).toBe(true);
    const outcome = drvRenteninformationParser.parse(doc);
    expect(outcome).toMatchObject({
      ok: true,
      record: {
        statementDate: '2024-05-10',
        payoutStart: '2057-05-01',
        identifier: '12 010190 A 123',
        figures: {
          dataPeriodFrom: '2004-09-01',
          dataPeriodTo: '2023-12-31',
          fullDisabilityMonthly: '1876.72',
          accruedMonthly: '636.18',
          projectedMonthly: '2734.46',
          projectedAt1Pct: '3790.00',
          projectedAt2Pct: '5250.00',
          earningsPoints: '16.9196',
          currentPensionValue: '37.60',
          contributionsOwn: '58492.35',
          contributionsEmployer: '58531.76',
          contributionsPublic: '3226.00',
        },
      },
    });
  });
});
