import type {
  RetirementCapitalAccountFigures,
  RetirementDepotFigures,
  RetirementPensionFigures,
  RetirementPillarSummary,
  RetirementRecord,
  RetirementStartRelation,
  RetirementSummary,
  RetirementSummaryItem,
} from '@vaultfolio/api-contract';
import { expectedMonthlyOf, guaranteedMonthlyOf, isIncomplete, isOutdated } from './freshness';
import { type Money, ZERO, dec, familyOf, maxOf, sum, toMoney } from './model';

type Contributions = Pick<
  RetirementPensionFigures,
  'contributionMonthly' | 'employerContributionMonthly'
>;

/** Monthly expected pension of a record: the statutory projection, else `max(expected, guaranteed)`. */
function itemExpected(record: RetirementRecord): Money {
  if (record.pillar === 'STATUTORY') return expectedMonthlyOf(record) ?? ZERO;
  return maxOf(expectedMonthlyOf(record) ?? ZERO, guaranteedMonthlyOf(record) ?? ZERO);
}

/** The capital figure kept out of the monthly sums (capital account balance, depot value). */
function itemCapital(record: RetirementRecord): Money | null {
  switch (familyOf(record.contractType)) {
    case 'CAPITAL_ACCOUNT':
      return (record.figures as RetirementCapitalAccountFigures).accountBalance;
    case 'DEPOT':
      return (record.figures as RetirementDepotFigures).currentValue ?? null;
    default:
      return null;
  }
}

/** Monthly own + employer contributions of an active occupational/private record. */
function itemSavings(record: RetirementRecord): Money {
  if (record.pillar === 'STATUTORY' || record.status !== 'ACTIVE') return ZERO;
  const figures = record.figures as Contributions;
  return sum([
    record.supplement?.contributionMonthly ?? figures.contributionMonthly,
    record.supplement?.employerContributionMonthly ?? figures.employerContributionMonthly,
  ]);
}

function relation(start: string | null, reference: string | null): RetirementStartRelation | null {
  if (!start || !reference) return null;
  if (start === reference) return 'SAME';
  return start < reference ? 'EARLIER' : 'LATER';
}

function pillarSummary(items: RetirementSummaryItem[]): RetirementPillarSummary {
  return {
    count: items.length,
    guaranteedMonthly: sum(items.map((i) => i.guaranteedMonthly)),
    expectedMonthly: sum(items.map((i) => i.expectedMonthly)),
    items,
  };
}

/**
 * Consolidated retirement overview (research R8), computed from decrypted records. Pure and exact:
 * monetary sums use decimal arithmetic; capital figures never enter the monthly sums. `now` is
 * injected so the 12-month "outdated" boundary is testable.
 */
export function summarize(records: readonly RetirementRecord[], now: Date): RetirementSummary {
  const statutory = records.find((r) => r.pillar === 'STATUTORY' && r.payoutStart);
  const earliest = records
    .filter((r) => r.payoutStart)
    .map((r) => r.payoutStart as string)
    .sort((a, b) => a.localeCompare(b))[0];
  let pensionStart: RetirementSummary['pensionStart'] = null;
  if (statutory) pensionStart = { date: statutory.payoutStart as string, source: 'STATUTORY' };
  else if (earliest) pensionStart = { date: earliest, source: 'EARLIEST_CONTRACT' };
  const reference = pensionStart?.source === 'STATUTORY' ? pensionStart.date : null;

  const items: RetirementSummaryItem[] = records.map((r) => ({
    id: r.id,
    pillar: r.pillar,
    contractType: r.contractType,
    origin: r.origin,
    providerLabel: r.providerLabel,
    guaranteedMonthly: toMoney(guaranteedMonthlyOf(r) ?? ZERO),
    expectedMonthly: itemExpected(r),
    capital: itemCapital(r),
    payoutStart: r.payoutStart,
    startRelation: r.pillar === 'STATUTORY' ? null : relation(r.payoutStart, reference),
    outdated: isOutdated(r.statementDate, now),
    incomplete: isIncomplete(r),
  }));

  const byPillar = (pillar: RetirementRecord['pillar']) => items.filter((i) => i.pillar === pillar);
  const pillars = {
    statutory: pillarSummary(byPillar('STATUTORY')),
    occupational: pillarSummary(byPillar('OCCUPATIONAL')),
    private: pillarSummary(byPillar('PRIVATE')),
  };
  const guaranteedMonthly = sum(items.map((i) => i.guaranteedMonthly));
  const expectedMonthly = sum(items.map((i) => i.expectedMonthly));
  const capitalItems = items.filter((i) => i.capital !== null);

  return {
    guaranteedMonthly,
    expectedMonthly,
    differenceMonthly: toMoney(dec(expectedMonthly).minus(dec(guaranteedMonthly))),
    monthlySavings: sum(records.map(itemSavings)),
    pensionStart,
    capital: { total: sum(capitalItems.map((i) => i.capital)), items: capitalItems },
    pillars,
    flags: {
      outdatedCount: items.filter((i) => i.outdated).length,
      incompleteCount: items.filter((i) => i.incomplete).length,
    },
    items,
  };
}
