import { type PdfDocumentText, toMoney } from '@vaultfolio/document-text';
import type { RetirementStatutoryFigures } from '@vaultfolio/api-contract';
import { runChecks, failedChecks } from '../checks';
import {
  amountAfter,
  dateAfter,
  decimalAfter,
  firstOf,
  indexOfLabel,
  datesIn,
  present,
  readLines,
} from './reading';
import type { ParseOutcome, StatementParser } from './types';

/**
 * Renteninformation of the Deutsche Rentenversicherung (statutory pension, research R6). Reads by
 * label from the text of a scan or a text PDF; the insurance number is the only identifier taken,
 * name, address and tax id are never read. Figures are never "healed": a misread value fails the
 * plausibility checks and the document is rejected as a whole.
 */
const ID = 'drv-renteninformation';
const VERSION = '1.0.0';

const VSNR = /\b(\d{2})\s?(\d{6})\s?([A-Z])\s?(\d{3})\b/;

function insuranceNumber(lines: readonly string[]): string | undefined {
  const i = indexOfLabel(lines, /Versicherungsnummer/i);
  if (i < 0) return undefined;
  const m = VSNR.exec(lines[i]) ?? (lines[i + 1] ? VSNR.exec(lines[i + 1]) : null);
  return m ? `${m[1]} ${m[2]} ${m[3]} ${m[4]}` : undefined;
}

function dataPeriod(lines: readonly string[]): { from?: string; to?: string } {
  const i = indexOfLabel(lines, /gespeicherten(?: Daten)?/i);
  const dates = i < 0 ? [] : datesIn(lines[i]);
  return dates.length >= 2 ? { from: dates[0], to: dates[1] } : {};
}

/** Whole-euro or cent amount followed by the currency (`etwa 3.790 EUR`, `5.250 Euro`). */
const EURO_AMOUNT = /(?<![\d.,])(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{2}))?\s?(?:EUR|Euro)\b/gi;

function euroAmountsIn(text: string): string[] {
  return [...text.matchAll(EURO_AMOUNT)].map((m) =>
    toMoney(`${m[1].replaceAll('.', '')}.${m[2] ?? '00'}`),
  );
}

/**
 * The two "etwa … EUR" variants of the 2024+ letter: they run through the sentence, so the first
 * amount (1 %) and the second (2 %) are read in order from the line that introduces them.
 */
function rawVariants(lines: readonly string[]): [string?, string?] {
  const i = indexOfLabel(lines, /Rente von etwa/i);
  if (i < 0) return [];
  const amounts = euroAmountsIn(lines.slice(i, i + 3).join(' '));
  return [amounts[0], amounts[1]];
}

function detects(doc: PdfDocumentText): boolean {
  const lines = readLines(doc);
  return (
    indexOfLabel(lines, /\bRenteninformation\b/i) >= 0 &&
    indexOfLabel(lines, /Versicherungsnummer/i) >= 0 &&
    indexOfLabel(lines, /Entgeltpunkte|Regelaltersrente|Regelaltersgrenze/i) >= 0
  );
}

function parse(doc: PdfDocumentText): ParseOutcome {
  const lines = readLines(doc);
  const statementDate = dateAfter(lines, /\bDatum\b/i);
  const payoutStart = firstOf(
    lines,
    [/Regelaltersgrenze erreichen Sie am/i, /Regelaltersrente würde am/i],
    dateAfter,
  );
  const projected = firstOf(
    lines,
    [
      /ohne (?:weitere )?Rentenanpassung(?: monatlich)?/i,
      /errechnete Rente in Höhe von/i,
      /Rentenanpassungen von uns eine monatliche Rente von/i,
    ],
    amountAfter,
  );
  if (!statementDate || !payoutStart || !projected) return { ok: false, error: 'INCOMPLETE' };

  const period = dataPeriod(lines);
  const figures: RetirementStatutoryFigures = present({
    dataPeriodFrom: period.from,
    dataPeriodTo: period.to,
    fullDisabilityMonthly: firstOf(
      lines,
      [
        /voller Erwerbsminderung(?: beträgt)?(?: monatlich)?/i,
        /erwerbsgemindert, bekämen Sie von uns eine monatliche Rente von/i,
      ],
      amountAfter,
    ),
    accruedMonthly: firstOf(
      lines,
      [
        /bisher erreichte Rentenanwartschaft(?: beträgt)?(?: monatlich)?/i,
        /einer monatlichen Rente von/i,
      ],
      amountAfter,
    ),
    projectedMonthly: projected,
    projectedAt1Pct: amountAfter(lines, /Rentenanpassung von 1\s?%/i) ?? rawVariants(lines)[0],
    projectedAt2Pct: amountAfter(lines, /Rentenanpassung von 2\s?%/i) ?? rawVariants(lines)[1],
    earningsPoints: firstOf(lines, [/Entgeltpunkte/i, /folgender Höhe erworben/i], decimalAfter),
    currentPensionValue: firstOf(
      lines,
      [/Aktuelle[rn]? Rentenwert/i, /aktuelle Rentenwert beträgt(?: zurzeit)?/i],
      amountAfter,
    ),
    contributionsOwn: firstOf(lines, [/Beiträge von Ihnen/i, /^Von Ihnen/i], amountAfter),
    contributionsEmployer: firstOf(
      lines,
      [/Beiträge von Arbeitgebern/i, /^Von Ihrem\/n Arbeitgeber/i],
      amountAfter,
    ),
    contributionsPublic: firstOf(
      lines,
      [/Beiträge von öffentlichen/i, /^Von öffentlichen Kassen/i],
      amountAfter,
    ),
  });

  const failed = failedChecks(
    runChecks('STATUTORY_PENSION', figures, { statementDate, payoutStart }),
  );
  if (failed.length > 0) return { ok: false, error: 'INCONSISTENT', failedChecks: failed };

  const identifier = insuranceNumber(lines);
  return {
    ok: true,
    parser: { id: ID, version: VERSION },
    record: {
      contractType: 'STATUTORY_PENSION',
      statementDate,
      payoutStart,
      ...(identifier ? { identifier } : {}),
      figures,
      missingSupplement: [],
    },
  };
}

export const drvRenteninformationParser: StatementParser = {
  id: ID,
  version: VERSION,
  detects,
  parse,
};
