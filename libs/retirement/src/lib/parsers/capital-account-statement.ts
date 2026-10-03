import { type PdfDocumentText } from '@vaultfolio/document-text';
import type { RetirementCapitalAccountFigures } from '@vaultfolio/api-contract';
import { failedChecks, runChecks } from '../checks';
import {
  amountAfter,
  dateAfter,
  indexOfLabel,
  percentAfter,
  present,
  readLines,
  textAfter,
} from './reading';
import type { ParseOutcome, StatementParser } from './types';

/**
 * Statement of a contribution-oriented employer capital account (research R6). The account balance
 * is capital, not a pension: the record imports as `CAPITAL_ACCOUNT` and the user may add an
 * expected monthly pension and the contribution split afterwards (supplement).
 */
const ID = 'capital-account-statement';
const VERSION = '1.0.0';

const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9 \-/.]{0,39}$/;

function detects(doc: PdfDocumentText): boolean {
  const lines = readLines(doc);
  return (
    indexOfLabel(lines, /Kapitalkonto|Versorgungskonto/i) >= 0 &&
    indexOfLabel(lines, /Kontostand zum Jahresende|Garantiezins|Zinsgutschrift/i) >= 0
  );
}

function reference(lines: readonly string[]): string | undefined {
  const raw = textAfter(lines, /(?:Versorgungs|Referenz|Vertrags)(?:nummer|-Nr\.?)\s*:?/i);
  return raw !== undefined && IDENTIFIER.test(raw) ? raw : undefined;
}

function parse(doc: PdfDocumentText): ParseOutcome {
  const lines = readLines(doc);
  const statementDate = dateAfter(lines, /\bStand\b\s*:?/i);
  const accountBalance = amountAfter(lines, /Kontostand zum Jahresende|Endbestand/i);
  if (!statementDate || !accountBalance) return { ok: false, error: 'INCOMPLETE' };

  const figures: RetirementCapitalAccountFigures = present({
    openingBalance: amountAfter(lines, /Kontostand zu Jahresbeginn|Anfangsbestand/i),
    accountBalance,
    guaranteedInterestRate: percentAfter(lines, /Garantiezins|Verzinsung/i),
    interestCredit: amountAfter(lines, /Zinsgutschrift/i),
    annualContribution: amountAfter(lines, /Beitragsgutschrift|Beitragszuführung/i),
    finalBonus: amountAfter(lines, /Schlussbonus|Schlussüberschuss/i),
  });

  const failed = failedChecks(runChecks('CAPITAL_ACCOUNT', figures, { statementDate }));
  if (failed.length > 0) return { ok: false, error: 'INCONSISTENT', failedChecks: failed };

  const providerLabel = textAfter(lines, /^Arbeitgeber\b\s*:?/i);
  const identifier = reference(lines);
  return {
    ok: true,
    parser: { id: ID, version: VERSION },
    record: {
      contractType: 'CAPITAL_ACCOUNT',
      statementDate,
      ...(providerLabel ? { providerLabel } : {}),
      ...(identifier ? { identifier } : {}),
      figures,
      missingSupplement: ['contributionMonthly', 'employerContributionMonthly', 'expectedMonthly'],
    },
  };
}

export const capitalAccountStatementParser: StatementParser = {
  id: ID,
  version: VERSION,
  detects,
  parse,
};
