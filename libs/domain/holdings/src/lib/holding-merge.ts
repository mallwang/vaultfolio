import type { AssetType } from './asset-type.js';
import type { Holding } from './holding.js';

export type MergeDecision = { kind: 'create' } | { kind: 'update'; existingId: string };

/** The fields `findMergeKey` reads; satisfied by both `Holding` and a validated submission. */
export interface MergeKeySource {
  readonly assetType: AssetType;
  readonly management: string;
  readonly isin: string | null;
  readonly metal: string | null;
  readonly name: string | null;
}

/**
 * Identity of "the same position": ETF `(isin, management)`, metal `(metal,
 * management)`, deposit `(normalised name, management)`. SHARE and CRYPTO are
 * purchase lots and never merge (`null`). Two holdings with equal non-null
 * keys are the same position.
 */
export function findMergeKey(holding: MergeKeySource): string | null {
  switch (holding.assetType) {
    case 'ETF':
      return JSON.stringify(['ETF', holding.isin, holding.management]);
    case 'PRECIOUS_METAL':
      return JSON.stringify(['PRECIOUS_METAL', holding.metal, holding.management]);
    case 'DEPOSIT_MONEY':
      return JSON.stringify([
        'DEPOSIT_MONEY',
        (holding.name ?? '').trim().replace(/\s+/g, ' ').toLowerCase(),
        holding.management,
      ]);
    default:
      return null;
  }
}

/**
 * Decides whether a validated submission creates a new row or replaces an
 * existing one in place (the caller keeps `id` and `createdAt`). Pure, no I/O.
 */
export function decideMerge(
  submission: MergeKeySource,
  existing: readonly Holding[],
): MergeDecision {
  const key = findMergeKey(submission);
  if (key === null) {
    return { kind: 'create' };
  }
  const match = existing.find((holding) => findMergeKey(holding) === key);
  return match ? { kind: 'update', existingId: match.id } : { kind: 'create' };
}
