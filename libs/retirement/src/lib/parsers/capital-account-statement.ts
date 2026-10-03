import { type PdfDocumentText, amountsIn } from '@vaultfolio/document-text';
import type { RetirementCapitalAccountFigures } from '@vaultfolio/api-contract';
import { failedChecks, runChecks } from '../checks';
import {
  amountAfter,
  dateAfter,
  firstOf,
  indexOfLabel,
  longDateIn,
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

const PERCENT_TOKEN = /\(\s*\d{1,3}(?:,\d{1,4})?\s?%\s*\)/;

/** Date of the closing balance line, written out ("Stand des Versorgungskontos (01. Januar 2019)"). */
function writtenStatementDate(lines: readonly string[]): string | undefined {
  const line = lines.find((l) => /Stand des (?:Versorgungs)?kontos/i.test(l));
  return line === undefined ? undefined : longDateIn(line);
}

/** Credited interest on the "Garantiezins (0,90%) für Kalenderjahr … 25,91" line (rate removed first). */
function interestOnRateLine(lines: readonly string[]): string | undefined {
  const line = lines.find((l) => /^Garantiezins\b/i.test(l));
  return line === undefined ? undefined : amountsIn(line.replace(PERCENT_TOKEN, ' ')).at(-1);
}

/** Employer named in "… Versorgungsanwartschaft gegenüber der <Arbeitgeber> aus." */
function employer(lines: readonly string[]): string | undefined {
  const marker = 'Versorgungsanwartschaft gegenüber';
  const line = lines.find((l) => l.includes(marker));
  if (line === undefined) return undefined;
  const rest = line.slice(line.indexOf(marker) + marker.length).trim();
  const end = rest.lastIndexOf(' aus');
  const name = (end < 0 ? rest : rest.slice(0, end)).replace(/^(?:der|dem) /, '').trim();
  return name === '' ? undefined : name;
}

function parse(doc: PdfDocumentText): ParseOutcome {
  const lines = readLines(doc);
  const statementDate = dateAfter(lines, /\bStand\b\s*:?/i) ?? writtenStatementDate(lines);
  const accountBalance = firstOf(
    lines,
    [/Kontostand zum Jahresende|Endbestand/i, /Stand des (?:Versorgungs)?kontos/i],
    amountAfter,
  );
  if (!statementDate || !accountBalance) return { ok: false, error: 'INCOMPLETE' };

  const figures: RetirementCapitalAccountFigures = present({
    openingBalance: firstOf(
      lines,
      [/Kontostand zu Jahresbeginn|Anfangsbestand/i, /^Kontostand\s*\(/i],
      amountAfter,
    ),
    accountBalance,
    guaranteedInterestRate: percentAfter(lines, /Garantiezins|Verzinsung/i),
    interestCredit: amountAfter(lines, /Zinsgutschrift/i) ?? interestOnRateLine(lines),
    annualContribution: amountAfter(lines, /Beitragsgutschrift|Beitragszuführung|Kontozuführung/i),
    finalBonus: amountAfter(lines, /Schlussbonus|Schlussüberschuss/i),
  });

  const failed = failedChecks(runChecks('CAPITAL_ACCOUNT', figures, { statementDate }));
  if (failed.length > 0) return { ok: false, error: 'INCONSISTENT', failedChecks: failed };

  const providerLabel = textAfter(lines, /^Arbeitgeber\b\s*:?/i) ?? employer(lines);
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
