import { type PdfDocumentText } from '@vaultfolio/document-text';
import type { RetirementStatutoryFigures } from '@vaultfolio/api-contract';
import { runChecks, failedChecks } from '../checks';
import {
  amountAfter,
  dateAfter,
  decimalAfter,
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
  const i = indexOfLabel(lines, /gespeicherten Daten/i);
  const dates = i < 0 ? [] : datesIn(lines[i]);
  return dates.length >= 2 ? { from: dates[0], to: dates[1] } : {};
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
  const payoutStart = dateAfter(lines, /Regelaltersgrenze erreichen Sie am/i);
  const projected = amountAfter(lines, /ohne (?:weitere )?Rentenanpassung(?: monatlich)?/i);
  if (!statementDate || !payoutStart || !projected) return { ok: false, error: 'INCOMPLETE' };

  const period = dataPeriod(lines);
  const figures: RetirementStatutoryFigures = present({
    dataPeriodFrom: period.from,
    dataPeriodTo: period.to,
    fullDisabilityMonthly: amountAfter(
      lines,
      /voller Erwerbsminderung(?: beträgt)?(?: monatlich)?/i,
    ),
    accruedMonthly: amountAfter(
      lines,
      /bisher erreichte Rentenanwartschaft(?: beträgt)?(?: monatlich)?/i,
    ),
    projectedMonthly: projected,
    projectedAt1Pct: amountAfter(lines, /Rentenanpassung von 1\s?%/i),
    projectedAt2Pct: amountAfter(lines, /Rentenanpassung von 2\s?%/i),
    earningsPoints: decimalAfter(lines, /Entgeltpunkte/i),
    currentPensionValue: amountAfter(lines, /Aktuelle[rn]? Rentenwert/i),
    contributionsOwn: amountAfter(lines, /Beiträge von Ihnen/i),
    contributionsEmployer: amountAfter(lines, /Beiträge von Arbeitgebern/i),
    contributionsPublic: amountAfter(lines, /Beiträge von öffentlichen/i),
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
