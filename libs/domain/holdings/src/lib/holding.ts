import Decimal from 'decimal.js';
import type { AssetType } from './asset-type.js';
import type { MetalCode } from './metal-catalog.js';
import type { HoldingUnit } from './units.js';

/**
 * One holding (data-model.md payload). Framework-independent (Principle I).
 * Monetary/quantity fields are `Decimal`, never `number`. Fields that do not
 * apply to the asset type are `null`.
 */
export interface HoldingProps {
  /** Generated at creation (`randomUUID()`), never client-supplied. */
  readonly id: string;
  /** Immutable after creation. */
  readonly assetType: AssetType;
  readonly management: string;
  /** Optional free text, at most 500 characters. */
  readonly note: string | null;
  /** ETF/SHARE only. */
  readonly isin: string | null;
  /** ETF/SHARE/DEPOSIT_MONEY only. */
  readonly name: string | null;
  /** PRECIOUS_METAL only (catalogue code). */
  readonly metal: MetalCode | null;
  /** CRYPTO only (catalogue id). */
  readonly coinId: string | null;
  /** ETF/SHARE/PRECIOUS_METAL/CRYPTO. */
  readonly quantity: Decimal | null;
  /** PRECIOUS_METAL only; the unit the quantity was entered in. */
  readonly unit: HoldingUnit | null;
  /** ETF/SHARE/CRYPTO. */
  readonly purchasePrice: Decimal | null;
  /** SHARE/CRYPTO, optional. */
  readonly purchaseDate: Date | null;
  /** PRECIOUS_METAL (optional) / DEPOSIT_MONEY. */
  readonly currentValue: Decimal | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export class Holding implements HoldingProps {
  readonly id: string;
  readonly assetType: AssetType;
  readonly management: string;
  readonly note: string | null;
  readonly isin: string | null;
  readonly name: string | null;
  readonly metal: MetalCode | null;
  readonly coinId: string | null;
  readonly quantity: Decimal | null;
  readonly unit: HoldingUnit | null;
  readonly purchasePrice: Decimal | null;
  readonly purchaseDate: Date | null;
  readonly currentValue: Decimal | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  constructor(props: HoldingProps) {
    this.id = props.id;
    this.assetType = props.assetType;
    this.management = props.management;
    this.note = props.note;
    this.isin = props.isin;
    this.name = props.name;
    this.metal = props.metal;
    this.coinId = props.coinId;
    this.quantity = props.quantity;
    this.unit = props.unit;
    this.purchasePrice = props.purchasePrice;
    this.purchaseDate = props.purchaseDate;
    this.currentValue = props.currentValue;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  /**
   * Value for the distribution view: `quantity × purchasePrice` for
   * ETF/SHARE/CRYPTO, `currentValue` for PRECIOUS_METAL/DEPOSIT_MONEY. `null`
   * when not computable (excluded from the base, never counted as zero).
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
