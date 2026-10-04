import Decimal from 'decimal.js';
import { classKey, defaultGroupOf, groupsOf, otherGroupOf } from './classes';
import type {
  BalanceGroup,
  ClassGroupAssignment,
  ClassRef,
  Side,
  WealthEntry,
  WealthSnapshot,
} from './model';
import { totalsOf } from './summary';

export interface BalanceGroupSection {
  group: BalanceGroup;
  subtotal: string;
  entries: WealthEntry[];
}

export interface BalanceSheet {
  assets: BalanceGroupSection[];
  liabilities: BalanceGroupSection[];
  /** Balancing figure (`assets − liabilities`); may be negative. */
  equity: string;
  sumAssets: string;
  /** `liabilities + equity`; always equals `sumAssets`. */
  sumPassiva: string;
}

/** The class's assignment, else the standard default, else the side's "other" group. */
export function effectiveGroup(
  side: Side,
  ref: ClassRef,
  assignments: readonly ClassGroupAssignment[],
): BalanceGroup {
  const key = classKey(side, ref);
  const assigned = assignments.find((a) => classKey(a.side, a.class) === key);
  if (assigned) return assigned.group;
  return 'standard' in ref ? defaultGroupOf(ref.standard) : otherGroupOf(side);
}

function sectionsOf(
  side: Side,
  entries: readonly WealthEntry[],
  assignments: readonly ClassGroupAssignment[],
): BalanceGroupSection[] {
  return groupsOf(side).map((group) => {
    const own = entries.filter(
      (e) => e.side === side && effectiveGroup(side, e.class, assignments) === group,
    );
    const subtotal = own.reduce((acc, e) => acc.plus(e.amount), new Decimal(0));
    return { group, subtotal: subtotal.toFixed(2), entries: own };
  });
}

export function balanceSheetOf(
  snapshot: Pick<WealthSnapshot, 'entries'>,
  assignments: readonly ClassGroupAssignment[],
): BalanceSheet {
  const totals = totalsOf(snapshot);
  const equity = new Decimal(totals.net);
  return {
    assets: sectionsOf('ASSET', snapshot.entries, assignments),
    liabilities: sectionsOf('LIABILITY', snapshot.entries, assignments),
    equity: equity.toFixed(2),
    sumAssets: totals.assets,
    sumPassiva: new Decimal(totals.liabilities).plus(equity).toFixed(2),
  };
}
