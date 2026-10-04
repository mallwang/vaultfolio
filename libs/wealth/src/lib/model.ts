export type Side = 'ASSET' | 'LIABILITY';

export type AssetClassId =
  | 'cash'
  | 'bankBalances'
  | 'preciousMetals'
  | 'securities'
  | 'crypto'
  | 'realEstate'
  | 'vehicles'
  | 'collectibles'
  | 'otherAsset';

export type LiabilityClassId = 'mortgage' | 'loan' | 'otherDebt';

export type StandardClassId = AssetClassId | LiabilityClassId;

export type ClassRef = { standard: StandardClassId } | { custom: string };

export type AssetGroup = 'LIQUID' | 'SECURITIES' | 'TANGIBLE' | 'OTHER_ASSET';
export type LiabilityGroup = 'SHORT_TERM' | 'LONG_TERM' | 'OTHER_LIABILITY';
export type BalanceGroup = AssetGroup | LiabilityGroup;

export interface WealthEntry {
  side: Side;
  class: ClassRef;
  name: string;
  /** Canonical decimal string, exactly two fractional digits, `0.00 … 999999999999.99`. */
  amount: string;
}

export interface WealthSnapshot {
  id: string;
  /** `YYYY-MM-DD`. */
  snapshotDate: string;
  note?: string;
  entries: WealthEntry[];
}

export interface WealthSnapshotInput {
  snapshotDate: string;
  note?: string;
  entries: WealthEntry[];
}

export interface ClassGroupAssignment {
  side: Side;
  class: ClassRef;
  group: BalanceGroup;
}

export interface WealthSettings {
  classGroups: ClassGroupAssignment[];
}

export type Period = '1y' | '3y' | 'all';

export const MAX_ENTRIES = 200;
export const MAX_SNAPSHOTS = 600;
export const MAX_NAME_LENGTH = 100;
export const MAX_CUSTOM_CLASS_LENGTH = 50;
export const MAX_NOTE_LENGTH = 500;
export const MIN_DATE = '1900-01-01';
export const MAX_AMOUNT = '999999999999.99';
