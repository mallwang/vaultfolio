import { type PdfDocumentText, amountsIn } from '@vaultfolio/document-text';
import type {
  RetirementPensionFigures,
  RetirementScenario,
  RetirementScenarioMonthly,
} from '@vaultfolio/api-contract';
import { failedChecks, runChecks } from '../checks';
import { amountAfter, dateAfter, indexOfLabel, present, readLines, textAfter } from './reading';
import type { MissingSupplement, ParseOutcome, StatementParser } from './types';

/**
 * Annual statement of a Riester or private pension contract (§ 155 VVG / AltZertG style, research
 * R6). The content is largely standardised by law, so the reader is label-based and independent of
 * the provider. Provider name and contract number are the only identifying text it takes.
 */
const ID = 'private-statement';
const VERSION = '1.0.0';

const SCENARIOS: readonly RetirementScenario[] = ['0', '3', '6', '9'];
const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9 \-/.]{0,39}$/;

function detects(doc: PdfDocumentText): boolean {
  const lines = readLines(doc);
  return (
    indexOfLabel(lines, /Jährliche Unterrichtung|§\s?155\s?VVG|Altersvorsorgevertrag/i) >= 0 &&
    indexOfLabel(lines, /Rentenzahlung|Rentenbeginn|Vertragswert|Garantierte/i) >= 0
  );
}

/** The four printed monthly pensions of the 0/3/6/9 % table (header row + value row). */
function scenarios(lines: readonly string[]): RetirementScenarioMonthly | undefined {
  const header = indexOfLabel(lines, /0\s?%\s+3\s?%\s+6\s?%\s+9\s?%/);
  if (header < 0) return undefined;
  const row = lines.slice(header + 1, header + 4).find((l) => /monatliche Rente/i.test(l));
  const amounts = row ? amountsIn(row) : [];
  if (amounts.length !== SCENARIOS.length) return undefined;
  return Object.fromEntries(SCENARIOS.map((s, i) => [s, amounts[i]])) as RetirementScenarioMonthly;
}

function contractIdentifier(lines: readonly string[]): string | undefined {
  const raw = textAfter(lines, /(?:Versicherungsschein|Vertrag)s?-?(?:nummer|Nr\.?)\s*:?/i);
  return raw !== undefined && IDENTIFIER.test(raw) ? raw : undefined;
}

function parse(doc: PdfDocumentText): ParseOutcome {
  const lines = readLines(doc);
  const riester = indexOfLabel(lines, /Riester|Altersvorsorgevertrag|AltZertG/i) >= 0;
  const statementDate = dateAfter(lines, /\bStand\b\s*:?/i);
  const scenarioMonthly = scenarios(lines);

  const figures: RetirementPensionFigures = present({
    guaranteedMonthly: amountAfter(lines, /Garantierte monatliche Rente/i),
    guaranteedCapital: amountAfter(lines, /Garantiertes Kapital(?: zu Rentenbeginn)?/i),
    scenarioMonthly,
    currentValue: amountAfter(lines, /Aktueller Vertragswert|Fondsguthaben|Deckungskapital/i),
    contributionsMain: amountAfter(lines, /Eingezahlte Beiträge|Beiträge bisher/i),
    contributionsExtra: amountAfter(lines, /Zuzahlungen|Sonderzahlungen/i),
    contributionsPaid: amountAfter(lines, /Summe aller bisherigen Einzahlungen|Gesamtbeiträge/i),
    surrenderValue: amountAfter(lines, /Rückkaufswert/i),
    deathBenefit: amountAfter(lines, /Todesfallleistung|Leistung bei Tod/i),
    guaranteePeriodYears: guaranteeYears(lines),
  });
  const hasBenefit =
    figures.guaranteedMonthly !== undefined ||
    figures.scenarioMonthly !== undefined ||
    figures.currentValue !== undefined;
  if (!statementDate || !hasBenefit) return { ok: false, error: 'INCOMPLETE' };

  const failed = failedChecks(
    runChecks(riester ? 'RIESTER' : 'PRIVATE_PENSION_INSURANCE', figures, { statementDate }),
  );
  if (failed.length > 0) return { ok: false, error: 'INCONSISTENT', failedChecks: failed };

  const providerLabel = textAfter(lines, /^(?:Versicherer|Anbieter)\b\s*:?/i);
  const identifier = contractIdentifier(lines);
  const payoutStart = dateAfter(
    lines,
    /Beginn der (?:Rentenzahlung|Auszahlung)\s*:?|Rentenbeginn\s*:?/i,
  );
  const missingSupplement: MissingSupplement[] = riester
    ? ['contributionMonthly', 'subsidiesYearly']
    : ['contributionMonthly'];

  return {
    ok: true,
    parser: { id: ID, version: VERSION },
    record: {
      contractType: riester ? 'RIESTER' : 'PRIVATE_PENSION_INSURANCE',
      statementDate,
      ...(payoutStart ? { payoutStart } : {}),
      ...(providerLabel ? { providerLabel } : {}),
      ...(identifier ? { identifier } : {}),
      figures,
      ...(scenarioMonthly ? { defaults: { expectedScenario: '3' as const } } : {}),
      missingSupplement,
    },
  };
}

function guaranteeYears(lines: readonly string[]): number | undefined {
  const text = textAfter(lines, /Rentengarantiezeit/i);
  const m = text === undefined ? null : /(\d{1,2})\s*Jahre/.exec(text);
  return m ? Number(m[1]) : undefined;
}

export const privateStatementParser: StatementParser = {
  id: ID,
  version: VERSION,
  detects,
  parse,
};
