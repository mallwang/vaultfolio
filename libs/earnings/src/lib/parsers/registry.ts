import { evaluateChecks } from '../checks';
import type { ParseOutcome } from '../model';
import type { PdfDocumentText } from './pdf-text';
import { lohnsteuerbescheinigungParser } from './lohnsteuerbescheinigung';
import { sapEntgeltnachweisParser } from './sap-entgeltnachweis';

export type DocumentType = 'PAYSLIP' | 'CERTIFICATE';

/**
 * A deterministic document parser (research R3, FR-045). `parse` never produces language text —
 * failures are error codes with params (FR-046) — and never reads personal identifiers (FR-009).
 */
export interface EarningsParser {
  id: string;
  /** Semver; bumped on any behavior change. */
  version: string;
  documentType: DocumentType;
  detect(doc: PdfDocumentText): boolean;
  parse(doc: PdfDocumentText): ParseOutcome;
}

/** Ordered: the first parser whose `detect` returns true wins. */
export const PARSER_REGISTRY: readonly EarningsParser[] = [
  lohnsteuerbescheinigungParser,
  sapEntgeltnachweisParser,
];

export type DocumentParseResult = ParseOutcome & {
  parserId?: string;
  parserVersion?: string;
  documentType?: DocumentType;
};

/**
 * Picks the first matching parser, parses, then runs every arithmetic check (NET per record,
 * PAYOUT per payslip). Any failing check turns the outcome into `CHECK_FAILED` (FR-012).
 */
export function parseDocument(
  doc: PdfDocumentText,
  registry: readonly EarningsParser[] = PARSER_REGISTRY,
): DocumentParseResult {
  const parser = registry.find((p) => p.detect(doc));
  if (!parser) {
    return { ok: false, error: { code: 'UNSUPPORTED_FORMAT' } };
  }
  const meta = {
    parserId: parser.id,
    parserVersion: parser.version,
    documentType: parser.documentType,
  };
  const outcome = parser.parse(doc);
  if (!outcome.ok) {
    return { ...outcome, ...meta };
  }
  const { failure } = evaluateChecks(outcome.records);
  return failure ? { ok: false, error: failure, ...meta } : { ...outcome, ...meta };
}
