import Decimal from 'decimal.js';
import type { AssetType } from './asset-type.js';

/**
 * The core entity (spec.md's "Holding" Key Entity, data-model.md's Holding
 * table): one holding row — either a purchase lot (Share/Bitcoin: one row per
 * submission) or a current position (ETF/Gold: one row per
 * `(identifier, management)` pair, replaced in place on repeat submission).
 * Framework-independent (Principle I) — no NestJS/Angular/Postgres-row
 * concerns here. All monetary/quantity fields are `Decimal`, never a native
 * `number` (constitution's Money/decimal handling clause).
 */
export interface HoldingProps {
  /** Generated at creation (`gen_random_uuid()`), never client-supplied. */
  readonly id: string;
  /** Immutable after creation (FR-008). */
  readonly assetType: AssetType;
  /** Free text, required for every asset type (FR-002). */
  readonly management: string;
  /** Required for ETF/SHARE/BITCOIN; `null` for GOLD. */
  readonly quantity: Decimal | null;
  /** Required for ETF/SHARE/BITCOIN; `null` for GOLD. "Average purchase price" for ETF. */
  readonly purchasePrice: Decimal | null;
  /** Optional for SHARE/BITCOIN only; always `null` for ETF/GOLD. */
  readonly purchaseDate: Date | null;
  /** Required for ETF/SHARE; `null` for GOLD/BITCOIN. */
  readonly isin: string | null;
  /** Required for ETF/SHARE; `null` for GOLD/BITCOIN. */
  readonly name: string | null;
  /** Required for GOLD; `null` otherwise. */
  readonly weightGrams: Decimal | null;
  /** Optional, GOLD only; `null` otherwise. */
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
   * purchasePrice` for Share/Bitcoin/ETF, `currentValue` for Gold. Returns
   * `null` when there is no computable value (e.g. Gold with no current value
   * entered) — such holdings are excluded from the percentage base entirely,
   * never counted as zero (research.md #6).
   */
  computeValue(): Decimal | null {
    if (this.assetType === 'GOLD') {
      return this.currentValue;
    }
    if (this.quantity && this.purchasePrice) {
      return this.quantity.times(this.purchasePrice);
    }
    return null;
  }
}
