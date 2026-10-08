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

/** Every field that can appear on a Holding, across all asset types (`management` is common and not listed). */
export type HoldingField =
  | 'isin'
  | 'name'
  | 'metal'
  | 'unit'
  | 'coinId'
  | 'quantity'
  | 'purchasePrice'
  | 'purchaseDate'
  | 'currentValue'
  | 'note';

export const ALL_HOLDING_FIELDS: readonly HoldingField[] = [
  'isin',
  'name',
  'metal',
  'unit',
  'coinId',
  'quantity',
  'purchasePrice',
  'purchaseDate',
  'currentValue',
  'note',
];

export interface AssetTypeFieldMetadata {
  /** Fields that MUST be present for a holding of this asset type. */
  readonly required: readonly HoldingField[];
  /** Fields that MAY be present for a holding of this asset type. */
  readonly optional: readonly HoldingField[];
}

/**
 * Per-type required/optional field table (data-model.md). Any `HoldingField`
 * not listed for a type must be absent on a holding of that type. The single
 * source for server validation and the frontend form (FR-018).
 */
export const ASSET_TYPE_FIELDS: Readonly<Record<AssetType, AssetTypeFieldMetadata>> = {
  ETF: {
    required: ['isin', 'name', 'quantity', 'purchasePrice'],
    optional: ['note'],
  },
  SHARE: {
    required: ['isin', 'name', 'quantity', 'purchasePrice'],
    optional: ['purchaseDate', 'note'],
  },
  PRECIOUS_METAL: {
    required: ['metal', 'quantity', 'unit'],
    optional: ['currentValue', 'note'],
  },
  CRYPTO: {
    required: ['coinId', 'quantity', 'purchasePrice'],
    optional: ['purchaseDate', 'note'],
  },
  DEPOSIT_MONEY: {
    required: ['name', 'currentValue'],
    optional: ['note'],
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
