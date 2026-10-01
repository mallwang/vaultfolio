import type { LayoutSubmissionV1 } from './layout-submission.js';

/**
 * Rule draft: optional hints marked in the preview (FR-010–FR-014). It carries no figures and no
 * text — the label of a marked line is derived server-side from the validated layout — and nothing
 * in the parsers or the import path reads it (FR-014); it is shown to administrators as a hint only.
 */

export const FIGURE_TYPES = [
  'GROSS',
  'TAX_GROSS',
  'WAGE_TAX',
  'SOLIDARITY',
  'CHURCH_TAX',
  'HEALTH',
  'CARE',
  'PENSION',
  'UNEMPLOYMENT',
  'NET',
  'PAYOUT',
  'IGNORE',
] as const;

export type FigureType = (typeof FIGURE_TYPES)[number];

export const RULE_FORMATS = ['DE_DECIMAL', 'CENTS', 'TRAILING_MINUS'] as const;

export type RuleFormat = (typeof RULE_FORMATS)[number];

export interface RuleColumn {
  x0: number;
  x1: number;
}

export interface SubmittedRuleLine {
  /** Index into `pages`. */
  page: number;
  /** Index into `pages[page].lines`. */
  line: number;
  figure: FigureType;
  deduction: boolean;
  column?: RuleColumn;
  format?: RuleFormat;
}

export interface SubmittedRuleDraft {
  lines: SubmittedRuleLine[];
  period?: { page: number; line: number; x0: number; x1: number };
}

export interface StoredRuleLine {
  page: number;
  line: number;
  label: string;
  figure: FigureType;
  deduction: boolean;
  column: RuleColumn | null;
  format: RuleFormat | null;
}

/** What the server stores in `requests.payload` for `earnings/new-parser` (data-model.md). */
export interface StoredRuleDraft {
  schemaVersion: 1;
  pages: number;
  lines: StoredRuleLine[];
  period: { page: number; line: number; x0: number; x1: number } | null;
}

/**
 * Server side: turns the submitted (already validated) draft into the stored one. The label is the
 * non-digit words of the referenced layout line — nothing else comes from the client.
 */
export function deriveRuleLabels(submission: LayoutSubmissionV1): StoredRuleDraft {
  const draft = submission.ruleDraft;
  return {
    schemaVersion: 1,
    pages: submission.pages.length,
    lines: (draft?.lines ?? []).map((rule) => ({
      page: rule.page,
      line: rule.line,
      label: submission.pages[rule.page].lines[rule.line].words
        .map((word) => word.text)
        .filter((text) => !/\d/.test(text))
        .join(' '),
      figure: rule.figure,
      deduction: rule.deduction,
      column: rule.column ? { x0: rule.column.x0, x1: rule.column.x1 } : null,
      format: rule.format ?? null,
    })),
    period: draft?.period ? { ...draft.period } : null,
  };
}
