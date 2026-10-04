/**
 * Shared contract for the Wealth API — see
 * specs/038-networth-tracking/contracts/wealth-api.md and data-model.md. Plain TypeScript
 * interfaces, no runtime dependency, imported by `apps/backend`, `libs/wealth` consumers and
 * `libs/frontend/domain/historic-wealth-development` so the tiers can never drift on shape
 * (Principle II).
 *
 * Amounts are canonical decimal strings with two fractional digits (`"12000.00"`), never JSON
 * numbers. No totals appear in any response; they are derived in `@vaultfolio/wealth`.
 */

export type WealthSide = 'ASSET' | 'LIABILITY';

export type WealthStandardClassId =
  | 'cash'
  | 'bankBalances'
  | 'preciousMetals'
  | 'securities'
  | 'crypto'
  | 'realEstate'
  | 'vehicles'
  | 'collectibles'
  | 'otherAsset'
  | 'mortgage'
  | 'loan'
  | 'otherDebt';

export type WealthClassRef = { standard: WealthStandardClassId } | { custom: string };

export type WealthBalanceGroup =
  | 'LIQUID'
  | 'SECURITIES'
  | 'TANGIBLE'
  | 'OTHER_ASSET'
  | 'SHORT_TERM'
  | 'LONG_TERM'
  | 'OTHER_LIABILITY';

export interface WealthEntry {
  side: WealthSide;
  class: WealthClassRef;
  name: string;
  /** Decimal string, two fractional digits, `0.00 … 999999999999.99`. */
  amount: string;
}

export interface WealthSnapshot {
  id: string;
  /** `YYYY-MM-DD`. */
  snapshotDate: string;
  note?: string;
  entries: WealthEntry[];
  createdAt: string;
  updatedAt: string;
}

/** Body of `POST`/`PUT /wealth/snapshots`: no id, no timestamps. */
export interface WealthSnapshotInput {
  snapshotDate: string;
  note?: string;
  entries: WealthEntry[];
}

export interface WealthClassGroupAssignment {
  side: WealthSide;
  class: WealthClassRef;
  group: WealthBalanceGroup;
}

export interface WealthSettings {
  classGroups: WealthClassGroupAssignment[];
}

/** Error codes (`error` field of the error body). */
export const WEALTH_ERROR = {
  validation: 'WEALTH_VALIDATION',
  unknownField: 'WEALTH_UNKNOWN_FIELD',
  limitExceeded: 'WEALTH_LIMIT_EXCEEDED',
  snapshotNotFound: 'WEALTH_SNAPSHOT_NOT_FOUND',
  snapshotDateExists: 'WEALTH_SNAPSHOT_DATE_EXISTS',
  unavailable: 'WEALTH_UNAVAILABLE',
} as const;

export type WealthErrorCode = (typeof WEALTH_ERROR)[keyof typeof WEALTH_ERROR];
