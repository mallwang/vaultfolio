import type { PdfDocumentText } from '@vaultfolio/document-text';
import type {
  RetirementCheckId,
  RetirementFigures,
  RetirementScenario,
} from '@vaultfolio/api-contract';
import type { ContractType } from '../model';

/** Figures a statement does not print and the user may add at review time (research R5). */
export type MissingSupplement =
  'contributionMonthly' | 'employerContributionMonthly' | 'subsidiesYearly' | 'expectedMonthly';

/** What a parser reads from a statement: whitelisted figures and the contract/insurance number only. */
export interface ParsedRecord {
  contractType: ContractType;
  /** `YYYY-MM-DD` of the statement/letter. */
  statementDate: string;
  payoutStart?: string;
  providerLabel?: string;
  identifier?: string;
  figures: RetirementFigures;
  defaults?: { expectedScenario?: RetirementScenario };
  missingSupplement: MissingSupplement[];
}

export type ParseOutcome =
  | { ok: true; parser: { id: string; version: string }; record: ParsedRecord }
  | {
      ok: false;
      error: 'UNRECOGNISED' | 'INCONSISTENT' | 'INCOMPLETE';
      failedChecks?: RetirementCheckId[];
    };

/** A deterministic statement reader (research R6). Never produces language text. */
export interface StatementParser {
  id: string;
  /** Semver; bumped on any behaviour change. */
  version: string;
  detects(doc: PdfDocumentText): boolean;
  /** Only called when `detects` is true. */
  parse(doc: PdfDocumentText): ParseOutcome;
}
