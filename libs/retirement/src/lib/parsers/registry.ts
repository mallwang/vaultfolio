import type { PdfDocumentText } from '@vaultfolio/document-text';
import { capitalAccountStatementParser } from './capital-account-statement';
import { drvRenteninformationParser } from './drv-renteninformation';
import { privateStatementParser } from './private-statement';
import type { ParseOutcome, StatementParser } from './types';

/** Ordered: the first parser whose `detects` returns true wins (research R6). */
export const PARSERS: readonly StatementParser[] = [
  drvRenteninformationParser,
  privateStatementParser,
  capitalAccountStatementParser,
];

/**
 * Picks the first matching parser and runs it. A document no parser detects is `UNRECOGNISED`
 * (fail closed — manual entry is offered); a recognised but inconsistent or incomplete document is
 * rejected as a whole.
 */
export function parseStatement(
  doc: PdfDocumentText,
  parsers: readonly StatementParser[] = PARSERS,
): ParseOutcome {
  const parser = parsers.find((p) => p.detects(doc));
  return parser ? parser.parse(doc) : { ok: false, error: 'UNRECOGNISED' };
}
