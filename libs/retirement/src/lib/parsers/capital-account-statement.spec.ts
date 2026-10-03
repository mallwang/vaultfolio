import {
  CAPITAL_ACCOUNT_EXPECTED,
  syntheticCapitalAccountStatement,
  syntheticCapitalAccountStatement2019,
  syntheticPrivateStatement,
} from '../testing/statements.fixtures';
import { capitalAccountStatementParser } from './capital-account-statement';

describe('capitalAccountStatementParser', () => {
  it('detects employer capital-account statements only', () => {
    expect(capitalAccountStatementParser.detects(syntheticCapitalAccountStatement())).toBe(true);
    expect(capitalAccountStatementParser.detects(syntheticPrivateStatement())).toBe(false);
  });

  it('imports balances, rate, credit, contribution and final bonus as a capital account', () => {
    const outcome = capitalAccountStatementParser.parse(syntheticCapitalAccountStatement());
    expect(outcome).toEqual({
      ok: true,
      parser: { id: 'capital-account-statement', version: '1.0.0' },
      record: {
        contractType: 'CAPITAL_ACCOUNT',
        statementDate: CAPITAL_ACCOUNT_EXPECTED.statementDate,
        providerLabel: CAPITAL_ACCOUNT_EXPECTED.providerLabel,
        identifier: CAPITAL_ACCOUNT_EXPECTED.identifier,
        figures: {
          openingBalance: CAPITAL_ACCOUNT_EXPECTED.openingBalance,
          accountBalance: CAPITAL_ACCOUNT_EXPECTED.accountBalance,
          guaranteedInterestRate: CAPITAL_ACCOUNT_EXPECTED.guaranteedInterestRate,
          interestCredit: CAPITAL_ACCOUNT_EXPECTED.interestCredit,
          annualContribution: CAPITAL_ACCOUNT_EXPECTED.annualContribution,
          finalBonus: CAPITAL_ACCOUNT_EXPECTED.finalBonus,
        },
        missingSupplement: [
          'contributionMonthly',
          'employerContributionMonthly',
          'expectedMonthly',
        ],
      },
    });
  });

  it('carries no monthly pension: the account is capital', () => {
    const outcome = capitalAccountStatementParser.parse(syntheticCapitalAccountStatement());
    expect(outcome.ok && Object.keys(outcome.record.figures)).not.toContain('guaranteedMonthly');
    expect(outcome.ok && Object.keys(outcome.record.figures)).not.toContain('expectedMonthly');
  });

  it('reads the scanned rendition after digit normalisation', () => {
    const outcome = capitalAccountStatementParser.parse(
      syntheticCapitalAccountStatement('scanned'),
    );
    expect(outcome.ok && outcome.record.figures).toMatchObject({
      openingBalance: '10000.00',
      accountBalance: '11325.00',
    });
  });

  it('rejects a roll-forward that does not add up as INCONSISTENT', () => {
    expect(
      capitalAccountStatementParser.parse(syntheticCapitalAccountStatement('misread')),
    ).toEqual({ ok: false, error: 'INCONSISTENT', failedChecks: ['ACCOUNT_ROLL_FORWARD'] });
  });

  it('rejects a statement without its closing balance as INCOMPLETE', () => {
    expect(
      capitalAccountStatementParser.parse(syntheticCapitalAccountStatement('missing-label')),
    ).toEqual({ ok: false, error: 'INCOMPLETE' });
  });

  it('reads the written-out account statement of 2019 (date with month name, rate and credit on one line)', () => {
    const doc = syntheticCapitalAccountStatement2019();
    expect(capitalAccountStatementParser.detects(doc)).toBe(true);
    expect(capitalAccountStatementParser.parse(doc)).toMatchObject({
      ok: true,
      record: {
        contractType: 'CAPITAL_ACCOUNT',
        statementDate: '2019-01-01',
        providerLabel: 'Beispiel GmbH',
        figures: {
          openingBalance: '2000.00',
          accountBalance: '3020.00',
          guaranteedInterestRate: '1.0000',
          interestCredit: '20.00',
          annualContribution: '1000.00',
          finalBonus: '0.00',
        },
      },
    });
  });
});
