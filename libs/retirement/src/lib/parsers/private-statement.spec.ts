import {
  PRIVATE_EXPECTED,
  syntheticCapitalAccountStatement,
  syntheticPrivateStatement,
  syntheticStandmitteilung,
} from '../testing/statements.fixtures';
import { privateStatementParser } from './private-statement';

describe('privateStatementParser', () => {
  it('detects annual statements of private and Riester contracts only', () => {
    expect(privateStatementParser.detects(syntheticPrivateStatement())).toBe(true);
    expect(privateStatementParser.detects(syntheticCapitalAccountStatement())).toBe(false);
  });

  it('reads guarantees, scenarios, values, contributions and guarantee period of a Riester contract', () => {
    const outcome = privateStatementParser.parse(syntheticPrivateStatement());
    expect(outcome).toEqual({
      ok: true,
      parser: { id: 'private-statement', version: '1.0.0' },
      record: {
        contractType: 'RIESTER',
        statementDate: PRIVATE_EXPECTED.statementDate,
        payoutStart: PRIVATE_EXPECTED.payoutStart,
        providerLabel: PRIVATE_EXPECTED.providerLabel,
        identifier: PRIVATE_EXPECTED.identifier,
        figures: {
          guaranteedMonthly: PRIVATE_EXPECTED.guaranteedMonthly,
          guaranteedCapital: PRIVATE_EXPECTED.guaranteedCapital,
          scenarioMonthly: PRIVATE_EXPECTED.scenarioMonthly,
          currentValue: PRIVATE_EXPECTED.currentValue,
          contributionsMain: PRIVATE_EXPECTED.contributionsMain,
          contributionsExtra: PRIVATE_EXPECTED.contributionsExtra,
          contributionsPaid: PRIVATE_EXPECTED.contributionsPaid,
          surrenderValue: PRIVATE_EXPECTED.surrenderValue,
          deathBenefit: PRIVATE_EXPECTED.deathBenefit,
          guaranteePeriodYears: PRIVATE_EXPECTED.guaranteePeriodYears,
        },
        defaults: { expectedScenario: '3' },
        missingSupplement: ['contributionMonthly', 'subsidiesYearly'],
      },
    });
  });

  it('imports a private pension insurance without the Riester subsidies', () => {
    const outcome = privateStatementParser.parse(syntheticPrivateStatement('valid', false));
    expect(outcome.ok && outcome.record.contractType).toBe('PRIVATE_PENSION_INSURANCE');
    expect(outcome.ok && outcome.record.missingSupplement).toEqual(['contributionMonthly']);
  });

  it('reads the scanned rendition after digit normalisation', () => {
    const scan = syntheticPrivateStatement('scanned');
    expect(JSON.stringify(scan)).toContain('1OO,OO');
    const outcome = privateStatementParser.parse(scan);
    expect(outcome.ok && outcome.record.figures).toMatchObject({
      guaranteedMonthly: '100.00',
      currentValue: '9000.00',
    });
  });

  it('rejects non-monotonic scenarios as INCONSISTENT', () => {
    expect(privateStatementParser.parse(syntheticPrivateStatement('misread'))).toEqual({
      ok: false,
      error: 'INCONSISTENT',
      failedChecks: ['SCENARIOS_MONOTONIC'],
    });
  });

  it('rejects a statement without its date as INCOMPLETE', () => {
    expect(privateStatementParser.parse(syntheticPrivateStatement('missing-label'))).toEqual({
      ok: false,
      error: 'INCOMPLETE',
    });
  });

  it('reads the standardised Standmitteilung of a Riester insurer', () => {
    const doc = syntheticStandmitteilung();
    expect(privateStatementParser.detects(doc)).toBe(true);
    expect(privateStatementParser.parse(doc)).toMatchObject({
      ok: true,
      record: {
        contractType: 'RIESTER',
        statementDate: '2024-04-01',
        payoutStart: '2057-04-01',
        providerLabel: 'Musterleben Lebensversicherung a. G.',
        identifier: '11 222 333',
        figures: {
          guaranteedMonthly: '171.00',
          guaranteedCapital: '68000.00',
          scenarioMonthly: { '0': '233.00', '3': '350.00', '6': '637.00', '9': '1230.00' },
          currentValue: '4200.00',
          contributionsMain: '3800.00',
          contributionsExtra: '500.00',
          contributionsPaid: '4300.00',
          surrenderValue: '3600.00',
          deathBenefit: '4100.00',
          guaranteePeriodYears: 23,
        },
        missingSupplement: ['contributionMonthly', 'subsidiesYearly'],
      },
    });
  });
});
