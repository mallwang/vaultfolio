/**
 * The fixed set of asset types a holding can be, per spec.md's "Asset Type" Key
 * Entity and data-model.md's AssetType table. A plain string union (not a
 * runtime enum) so both `apps/backend` and `apps/frontend` can share the exact
 * same literals via `libs/api-contract` without a vendor-specific runtime
 * dependency (FR-001).
 */
export type AssetType = 'ETF' | 'SHARE' | 'PRECIOUS_METAL' | 'CRYPTO' | 'DEPOSIT_MONEY';

export const ASSET_TYPES: readonly AssetType[] = [
  'ETF',
  'SHARE',
  'PRECIOUS_METAL',
  'CRYPTO',
  'DEPOSIT_MONEY',
];

/** Every field that can appear on a Holding, across all asset types. */
export type HoldingField =
  'isin' | 'name' | 'quantity' | 'purchasePrice' | 'purchaseDate' | 'weightGrams' | 'currentValue';

export interface AssetTypeFieldMetadata {
  /** Fields that MUST be present for a holding of this asset type (FR-003–FR-007). */
  readonly required: readonly HoldingField[];
  /** Fields that MAY be present for a holding of this asset type. */
  readonly optional: readonly HoldingField[];
}

/**
 * Per-type required/optional field metadata, per data-model.md's AssetType
 * table. Any `HoldingField` not listed here (in either `required` or
 * `optional`) for a given type MUST be absent/null on a holding of that type
 * (FR-008, Edge Cases: switching type must discard fields that don't apply).
 *
 * Notably: ETF has no `purchaseDate` field at all (not merely optional) —
 * FR-005. Precious metal has no `isin`/`purchasePrice`/`purchaseDate` — FR-006.
 */
export const ASSET_TYPE_FIELDS: Readonly<Record<AssetType, AssetTypeFieldMetadata>> = {
  ETF: {
    required: ['isin', 'name', 'quantity', 'purchasePrice'],
    optional: [],
  },
  SHARE: {
    required: ['isin', 'name', 'quantity', 'purchasePrice'],
    optional: ['purchaseDate'],
  },
  PRECIOUS_METAL: {
    required: ['name', 'weightGrams'],
    optional: ['currentValue'],
  },
  CRYPTO: {
    required: ['name', 'quantity', 'purchasePrice'],
    optional: ['purchaseDate'],
  },
  DEPOSIT_MONEY: {
    required: ['name', 'currentValue'],
    optional: [],
  },
};

/** All fields applicable (required or optional) to the given asset type. */
export function fieldsForAssetType(assetType: AssetType): readonly HoldingField[] {
  const metadata = ASSET_TYPE_FIELDS[assetType];
  return [...metadata.required, ...metadata.optional];
}

export function isAssetType(value: unknown): value is AssetType {
  return typeof value === 'string' && (ASSET_TYPES as readonly string[]).includes(value);
}
