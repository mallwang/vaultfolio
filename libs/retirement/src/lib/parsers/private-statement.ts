import Decimal from 'decimal.js';
import { type PdfDocumentText, amountsIn, toMoney } from '@vaultfolio/document-text';
import type {
  RetirementPensionFigures,
  RetirementScenario,
  RetirementScenarioMonthly,
} from '@vaultfolio/api-contract';
import { failedChecks, runChecks } from '../checks';
import {
  amountAfter,
  dateAfter,
  dateIn,
  firstOf,
  indexOfLabel,
  present,
  readLines,
  textAfter,
} from './reading';
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
    indexOfLabel(
      lines,
      /Jährliche Unterrichtung|§\s?155\s?VVG|Altersvorsorgevertrag|Standmitteilung/i,
    ) >= 0 && indexOfLabel(lines, /Rentenzahlung|Rentenbeginn|Vertragswert|Garantierte/i) >= 0
  );
}

/** The four printed monthly pensions of the 0/3/6/9 % table (header row + value row). */
function scenarios(lines: readonly string[]): RetirementScenarioMonthly | undefined {
  return standardisedScenarios(lines) ?? labelledScenarios(lines);
}

const SCENARIO_HEADER = /0\s?%\s+3\s?%\s+6\s?%\s+9\s?%/;

/** The standardised table "Mögliche Gesamtrente …": a header row, then one row of four amounts. */
function standardisedScenarios(lines: readonly string[]): RetirementScenarioMonthly | undefined {
  const title = indexOfLabel(lines, /Mögliche Gesamtrente/i);
  if (title < 0) return undefined;
  const header = lines.findIndex((l, i) => i >= title && i <= title + 2 && SCENARIO_HEADER.test(l));
  if (header < 0) return undefined;
  const row = lines.slice(header + 1, header + 4).find((l) => amountsIn(l).length === 4);
  const amounts = row ? amountsIn(row) : [];
  return amounts.length === SCENARIOS.length
    ? (Object.fromEntries(SCENARIOS.map((s, i) => [s, amounts[i]])) as RetirementScenarioMonthly)
    : undefined;
}

function labelledScenarios(lines: readonly string[]): RetirementScenarioMonthly | undefined {
  const header = indexOfLabel(lines, /0\s?%\s+3\s?%\s+6\s?%\s+9\s?%/);
  if (header < 0) return undefined;
  const row = lines.slice(header + 1, header + 4).find((l) => /monatliche Rente/i.test(l));
  const amounts = row ? amountsIn(row) : [];
  if (amounts.length !== SCENARIOS.length) return undefined;
  return Object.fromEntries(SCENARIOS.map((s, i) => [s, amounts[i]])) as RetirementScenarioMonthly;
}

function contractIdentifier(lines: readonly string[]): string | undefined {
  const raw =
    textAfter(lines, /(?:Versicherungsschein|Vertrag)s?-?(?:nummer|Nr\.?)\s*:?/i) ??
    textAfter(lines, /^für Versicherung\b/i);
  return raw !== undefined && IDENTIFIER.test(raw) ? raw : undefined;
}

function parse(doc: PdfDocumentText): ParseOutcome {
  const lines = readLines(doc);
  const riester = indexOfLabel(lines, /Riester|FörderRente|Altersvorsorgevertrag|AltZertG/i) >= 0;
  const statementDate = firstOf(lines, [/\bStand\b\s*:?/i, /Standmitteilung zum/i], dateAfter);
  const scenarioMonthly = scenarios(lines);

  const figures: RetirementPensionFigures = present({
    guaranteedMonthly: firstOf(
      lines,
      [/Garantierte monatliche Rente/i, /oder garantierte Rente zum \d{2}\.\d{2}\.\d{4}/i],
      amountAfter,
    ),
    guaranteedCapital: firstOf(
      lines,
      [
        /Garantiertes Kapital(?: zu Rentenbeginn)?/i,
        /Garantiertes Rentenkapital zum \d{2}\.\d{2}\.\d{4}/i,
      ],
      amountAfter,
    ),
    scenarioMonthly,
    currentValue: currentValue(lines),
    contributionsMain: firstOf(
      lines,
      [/Eingezahlte Beiträge|Beiträge bisher/i, /^Summe der gezahlten Beiträge/i],
      amountAfter,
    ),
    contributionsExtra: amountAfter(lines, /Zuzahlungen|Sonderzahlungen/i),
    contributionsPaid: firstOf(
      lines,
      [/Summe aller bisherigen Einzahlungen|Gesamtbeiträge/i, /^Insgesamt gezahlte Beiträge/i],
      amountAfter,
    ),
    surrenderValue: firstOf(
      lines,
      [/Rückkaufswert/i, /Derzeitige Leistung bei Kündigung/i],
      amountAfter,
    ),
    deathBenefit: firstOf(
      lines,
      [/Derzeitige Todesfallleistung/i, /Todesfallleistung|Leistung bei Tod/i],
      amountAfter,
    ),
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

  const providerLabel = textAfter(lines, /^(?:Versicherer|Anbieter)\b\s*:?/i) ?? letterhead(lines);
  const identifier = contractIdentifier(lines);
  const payoutStart =
    dateAfter(lines, /Beginn der (?:Rentenzahlung|Auszahlung)\s*:?|Rentenbeginn\s*:?/i) ??
    tablePayoutStart(lines);
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
  if (m) return Number(m[1]);
  // standardised letter: "Vereinbarter Rentenbeginn … 23 Jahre" under the guarantee-period heading
  const row = lines.map((l) => /Rentenbeginn\s+(\d{1,2})\s*Jahre/.exec(l)).find((x) => x !== null);
  return row ? Number(row[1]) : undefined;
}

/** Date in front of "Vereinbarter Rentenbeginn" in the example-calculation table. */
function tablePayoutStart(lines: readonly string[]): string | undefined {
  const line = lines.find((l) => /^\d{2}\.\d{2}\.\d{4}\s+Vereinbarter Rentenbeginn/i.test(l));
  return line === undefined ? undefined : dateIn(line);
}

/**
 * Current value of the contract: the printed "Aktueller Vertragswert", or for hybrid contracts
 * the conventional reserve plus the total of the fund holdings (the letter prints both parts).
 */
function currentValue(lines: readonly string[]): string | undefined {
  const printed = firstOf(lines, [/Aktueller Vertragswert/i], amountAfter);
  if (printed !== undefined) return printed;
  const conventional = firstOf(lines, [/Deckungskapital/i, /Fondsguthaben/i], amountAfter);
  if (conventional === undefined) return undefined;
  const funds = amountAfter(lines, /Gesamtwert des Fondsbestands/i);
  return funds === undefined ? conventional : toMoney(new Decimal(conventional).plus(funds));
}

/** Provider named in the letterhead: the first line when it is a company name. */
function letterhead(lines: readonly string[]): string | undefined {
  const first = lines[0]?.trim();
  return first !== undefined &&
    first.length <= 80 &&
    /(Versicherung|Versicherer|Leben)\b.*\b(AG|a\. ?G\.|SE|VVaG|GmbH)/i.test(first)
    ? first
    : undefined;
}

export const privateStatementParser: StatementParser = {
  id: ID,
  version: VERSION,
  detects,
  parse,
};
