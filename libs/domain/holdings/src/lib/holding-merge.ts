import type { Holding } from './holding.js';
import type { ValidatedHolding } from './holding-validation.js';

export type MergeDecision = { kind: 'create' } | { kind: 'update'; existingId: string };

/**
 * FR-011/FR-011a: given a validated incoming submission and the set of
 * existing holdings, decides whether the repository should insert a new row
 * or replace an existing one in place. A pure decision function — no I/O
 * (Principle I) — mirrored by the repository's own upsert-lookup query
 * (research.md #4) so "what counts as the same asset" lives in one place.
 *
 * - SHARE/CRYPTO: always a new row, regardless of any match.
 * - ETF: matches an existing row on `(isin, management)`.
 * - PRECIOUS_METAL: matches an existing row on `(name, management)` — "Gold"
 *   and "Silver" under the same Management never match each other (FR-005).
 * - A match under a *different* management value never counts as the same
 *   asset — Management is part of the identity key for both ETF and
 *   Precious metal.
 */
export function decideMerge(
  submission: ValidatedHolding,
  existing: readonly Holding[],
): MergeDecision {
  if (submission.assetType === 'SHARE' || submission.assetType === 'CRYPTO') {
    return { kind: 'create' };
  }

  const match = existing.find((holding) => {
    if (holding.assetType !== submission.assetType) {
      return false;
    }
    if (holding.management !== submission.management) {
      return false;
    }
    if (submission.assetType === 'ETF') {
      return holding.isin === submission.isin;
    }
    // PRECIOUS_METAL: management match alone is not sufficient — name must match too.
    return holding.name === submission.name;
  });

  return match ? { kind: 'update', existingId: match.id } : { kind: 'create' };
}
