import Decimal from 'decimal.js';
import type { AssetType } from './asset-type.js';

/**
 * The core entity (spec.md's "Holding" Key Entity, data-model.md's Holding
 * table): one holding row — either a purchase lot (Share/Crypto: one row per
 * submission) or a current position (ETF/Precious metal: one row per
 * `(identifier, management)` pair, replaced in place on repeat submission).
 * Framework-independent (Principle I) — no NestJS/Angular/SQLite-row
 * concerns here. All monetary/quantity fields are `Decimal`, never a native
 * `number` (constitution's Money/decimal handling clause).
 */
export interface HoldingProps {
  /** Generated at creation (`randomUUID()`), never client-supplied. */
  readonly id: string;
  /** Immutable after creation (FR-008). */
  readonly assetType: AssetType;
  /** Free text, required for every asset type (FR-002). */
  readonly management: string;
  /** Required for ETF/SHARE/CRYPTO; `null` for PRECIOUS_METAL. */
  readonly quantity: Decimal | null;
  /** Required for ETF/SHARE/CRYPTO; `null` for PRECIOUS_METAL. "Average purchase price" for ETF. */
  readonly purchasePrice: Decimal | null;
  /** Optional for SHARE/CRYPTO only; always `null` for ETF/PRECIOUS_METAL. */
  readonly purchaseDate: Date | null;
  /** Required for ETF/SHARE; `null` for PRECIOUS_METAL/CRYPTO. */
  readonly isin: string | null;
  /** Required for ETF/SHARE/PRECIOUS_METAL/CRYPTO. */
  readonly name: string | null;
  /** Required for PRECIOUS_METAL; `null` otherwise. */
  readonly weightGrams: Decimal | null;
  /** Optional, PRECIOUS_METAL only; `null` otherwise. */
  readonly currentValue: Decimal | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export class Holding implements HoldingProps {
  readonly id: string;
  readonly assetType: AssetType;
  readonly management: string;
  readonly quantity: Decimal | null;
  readonly purchasePrice: Decimal | null;
  readonly purchaseDate: Date | null;
  readonly isin: string | null;
  readonly name: string | null;
  readonly weightGrams: Decimal | null;
  readonly currentValue: Decimal | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  constructor(props: HoldingProps) {
    this.id = props.id;
    this.assetType = props.assetType;
    this.management = props.management;
    this.quantity = props.quantity;
    this.purchasePrice = props.purchasePrice;
    this.purchaseDate = props.purchaseDate;
    this.isin = props.isin;
    this.name = props.name;
    this.weightGrams = props.weightGrams;
    this.currentValue = props.currentValue;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  /**
   * This holding's value for the FR-012a distribution view: `quantity ×
   * purchasePrice` for Share/Crypto/ETF, `currentValue` for Precious metal.
   * Returns `null` when there is no computable value (e.g. Precious metal
   * with no current value entered) — such holdings are excluded from the
   * percentage base entirely, never counted as zero (research.md #6).
   */
  computeValue(): Decimal | null {
    if (this.assetType === 'PRECIOUS_METAL' || this.assetType === 'DEPOSIT_MONEY') {
      return this.currentValue;
    }
    if (this.quantity && this.purchasePrice) {
      return this.quantity.times(this.purchasePrice);
    }
    return null;
  }
}
