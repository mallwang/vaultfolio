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
 * - SHARE/BITCOIN: always a new row, regardless of any match.
 * - ETF: matches an existing row on `(isin, management)`.
 * - GOLD: matches an existing row on `(management)` alone — "the fact of
 *   being Gold" is the asset identifier, per spec.md's Clarifications.
 * - A match under a *different* management value never counts as the same
 *   asset — Management is part of the identity key for both ETF and Gold.
 */
export function decideMerge(
  submission: ValidatedHolding,
  existing: readonly Holding[],
): MergeDecision {
  if (submission.assetType === 'SHARE' || submission.assetType === 'BITCOIN') {
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
    // GOLD: management match alone is sufficient.
    return true;
  });

  return match ? { kind: 'update', existingId: match.id } : { kind: 'create' };
}
