import Decimal from 'decimal.js';
import type { HoldingResponse } from '@vaultfolio/api-contract';

/**
 * data-model.md "New view-model types" — the shared, exported valuation and
 * grouping logic extracted from `HoldingsDistributionComponent`'s former
 * private `computeValue`/`recompute` methods (research.md #1), so both the
 * main (by-`assetType`) chart and the new per-type (by-`name`) charts apply
 * byte-for-byte the same "computable value" rule and excluded-holdings
 * accounting (Principle I).
 *
 * `currentValue` for `PRECIOUS_METAL`/`DEPOSIT_MONEY`, `quantity ×
 * purchasePrice` for `ETF`/`SHARE`/`CRYPTO`; `null` when the relevant
 * field(s) are missing (not computable).
 */
export function computeHoldingValue(holding: HoldingResponse): Decimal | null {
  if (holding.assetType === 'PRECIOUS_METAL' || holding.assetType === 'DEPOSIT_MONEY') {
    return holding.currentValue != null ? new Decimal(holding.currentValue) : null;
  }
  if (holding.quantity != null && holding.purchasePrice != null) {
    return new Decimal(holding.quantity).times(holding.purchasePrice);
  }
  return null;
}

/** data-model.md "GroupedValueEntry<K>" — one aggregated segment. */
export interface GroupedValueEntry<K> {
  key: K;
  value: Decimal;
}

/** data-model.md "GroupedValueResult<K>" — the full result of one grouping pass. */
export interface GroupedValueResult<K> {
  entries: GroupedValueEntry<K>[];
  excludedCount: number;
}

/**
 * Sums `computeHoldingValue(...)` per key returned by `keyOf`, in first-seen
 * key order. A holding whose value or `keyOf` result is `null` contributes
 * to neither an entry nor the total, and increments `excludedCount` instead
 * (data-model.md "Validation / derivation rules").
 */
export function groupHoldingsByKey<K>(
  holdings: HoldingResponse[],
  keyOf: (holding: HoldingResponse) => K | null,
): GroupedValueResult<K> {
  const totals = new Map<K, Decimal>();
  let excludedCount = 0;

  for (const holding of holdings) {
    const value = computeHoldingValue(holding);
    const key = keyOf(holding);
    if (value == null || key == null) {
      excludedCount += 1;
      continue;
    }
    totals.set(key, (totals.get(key) ?? new Decimal(0)).plus(value));
  }

  return {
    entries: [...totals.entries()].map(([key, value]) => ({ key, value })),
    excludedCount,
  };
}
