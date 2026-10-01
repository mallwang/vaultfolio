import Decimal from 'decimal.js';
import { runPayoutCheck, runRecordChecks } from '../checks.js';
import { emptyPayRecordAmounts, type PayRecordAmounts, toMoney, ZERO } from '../model.js';
import type { AnalyzedLayout, AnalyzedWord } from './anonymize.js';
import type {
  FigureType,
  RuleFormat,
  SubmittedRuleDraft,
  SubmittedRuleLine,
} from './rule-draft.js';

export interface LiveCheckResult {
  checks: { id: 'NET' | 'PAYOUT'; passed: boolean | null; involved: FigureType[] }[];
  /** Money strings of the figures read from the marked columns (on-device only). */
  derived: Partial<Record<FigureType, string>>;
}

const AMOUNT_KEY: Partial<Record<FigureType, keyof PayRecordAmounts>> = {
  GROSS: 'gross',
  TAX_GROSS: 'taxGross',
  WAGE_TAX: 'wageTax',
  SOLIDARITY: 'soli',
  CHURCH_TAX: 'churchTax',
  HEALTH: 'health',
  CARE: 'care',
  PENSION: 'pension',
  UNEMPLOYMENT: 'unemployment',
  NET: 'net',
};

/** Figures that enter `gross − taxes − social = net`, in the order shown to the user. */
const NET_FIGURES: readonly FigureType[] = [
  'GROSS',
  'WAGE_TAX',
  'SOLIDARITY',
  'CHURCH_TAX',
  'HEALTH',
  'CARE',
  'PENSION',
  'UNEMPLOYMENT',
  'NET',
];

const DE_DECIMAL = /^(-?)(\d[\d.]*),(\d{2})$/;
const TRAILING_MINUS = /^(\d[\d.]*),(\d{2})-$/;
const CENTS = /^(-?)(\d+)$/;

function parseNumber(text: string, format: RuleFormat): Decimal | null {
  if (format === 'DE_DECIMAL') {
    const m = DE_DECIMAL.exec(text);
    return m ? new Decimal(`${m[1]}${m[2].replaceAll('.', '')}.${m[3]}`) : null;
  }
  if (format === 'TRAILING_MINUS') {
    const m = TRAILING_MINUS.exec(text);
    return m ? new Decimal(`-${m[1].replaceAll('.', '')}.${m[2]}`) : null;
  }
  const m = CENTS.exec(text);
  return m ? new Decimal(`${m[1]}${m[2]}`).dividedBy(100) : null;
}

function wordInColumn(
  words: readonly AnalyzedWord[],
  x0: number,
  x1: number,
): AnalyzedWord | undefined {
  return words.find((word) => word.x < x1 && word.x + word.width > x0);
}

function readLine(original: AnalyzedLayout, rule: SubmittedRuleLine): Decimal | null {
  if (!rule.column || !rule.format) return null;
  const words = original.pages[rule.page]?.lines[rule.line]?.words;
  if (!words) return null;
  const word = wordInColumn(words, rule.column.x0, rule.column.x1);
  if (!word) return null;
  const value = parseNumber(word.text, rule.format);
  if (!value) return null;
  return rule.deduction ? value.abs() : value;
}

function derive(
  original: AnalyzedLayout,
  draft: SubmittedRuleDraft,
): Partial<Record<FigureType, Decimal>> {
  const derived: Partial<Record<FigureType, Decimal>> = {};
  for (const rule of draft.lines) {
    if (rule.figure === 'IGNORE') continue;
    const value = readLine(original, rule);
    if (value) derived[rule.figure] = (derived[rule.figure] ?? new Decimal(0)).plus(value);
  }
  return derived;
}

/**
 * On-device arithmetic check of the user's markings (FR-012, SC-012): reads the figures from the
 * ORIGINAL amounts, runs the existing NET and PAYOUT checks and reports which figures were
 * involved. `passed: null` means there are not enough markings to judge. The result is shown to
 * the user only and is never part of a submission.
 */
export function liveCheck(original: AnalyzedLayout, draft: SubmittedRuleDraft): LiveCheckResult {
  const figures = derive(original, draft);
  const derived: Partial<Record<FigureType, string>> = {};
  for (const [figure, value] of Object.entries(figures)) {
    derived[figure as FigureType] = toMoney(value);
  }

  const amounts = emptyPayRecordAmounts();
  for (const [figure, key] of Object.entries(AMOUNT_KEY)) {
    const value = derived[figure as FigureType];
    if (value !== undefined) (amounts[key as 'gross'] as string) = value;
  }

  const netInvolved = NET_FIGURES.filter((figure) => derived[figure] !== undefined);
  const netReady = derived.GROSS !== undefined && derived.NET !== undefined;
  const payoutReady = derived.NET !== undefined && derived.PAYOUT !== undefined;

  return {
    derived,
    checks: [
      {
        id: 'NET',
        passed: netReady ? runRecordChecks({ amounts })[0].passed : null,
        involved: netInvolved,
      },
      {
        id: 'PAYOUT',
        passed: payoutReady
          ? runPayoutCheck([
              { amounts: { ...amounts, other: ZERO, payout: derived.PAYOUT as string } },
            ]).passed
          : null,
        involved: ['NET', 'PAYOUT'].filter(
          (figure) => derived[figure as FigureType] !== undefined,
        ) as FigureType[],
      },
    ],
  };
}
