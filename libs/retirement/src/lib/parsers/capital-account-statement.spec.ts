import {
  CAPITAL_ACCOUNT_EXPECTED,
  syntheticCapitalAccountStatement,
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
});
