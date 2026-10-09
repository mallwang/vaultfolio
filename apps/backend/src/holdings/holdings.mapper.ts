import Decimal from 'decimal.js';
import { Holding } from '@vaultfolio/domain-holdings';
import type { AssetType, HoldingSubmission, ValidatedHolding } from '@vaultfolio/domain-holdings';
import type {
  CreateHoldingRequest,
  HoldingResponse,
  UpdateHoldingRequest,
} from '@vaultfolio/api-contract';

/** Raw `better-sqlite3` row of the `holdings` table; everything but the ids lives in `payload_enc`. */
export interface HoldingRow {
  id: string;
  owner_id: string;
  payload_enc: string;
  key_version: number;
  created_at: string;
  updated_at: string;
}

/** The encrypted JSON payload: decimals as strings, a pre-rework `purchaseDate` key in old payloads is ignored. */
export interface HoldingPayload {
  assetType: AssetType;
  management: string;
  note: string | null;
  isin: string | null;
  name: string | null;
  metal: string | null;
  coinId: string | null;
  quantity: string | null;
  unit: string | null;
  purchasePrice: string | null;
  currentValue: string | null;
}

const decimalOrNull = (value: string | null): Decimal | null =>
  value == null ? null : new Decimal(value);

/** Validated submission -> the payload that gets encrypted. */
export function validatedHoldingToPayload(value: ValidatedHolding): HoldingPayload {
  return {
    assetType: value.assetType,
    management: value.management,
    note: value.note,
    isin: value.isin,
    name: value.name,
    metal: value.metal,
    coinId: value.coinId,
    quantity: value.quantity?.toFixed() ?? null,
    unit: value.unit,
    purchasePrice: value.purchasePrice?.toFixed() ?? null,
    currentValue: value.currentValue?.toFixed() ?? null,
  };
}

/** Decrypted payload + row metadata -> domain `Holding`. */
export function payloadToHolding(
  row: Pick<HoldingRow, 'id' | 'created_at' | 'updated_at'>,
  payload: HoldingPayload,
): Holding {
  return new Holding({
    id: row.id,
    assetType: payload.assetType,
    management: payload.management,
    note: payload.note,
    isin: payload.isin,
    name: payload.name,
    metal: payload.metal as Holding['metal'],
    coinId: payload.coinId,
    quantity: decimalOrNull(payload.quantity),
    unit: payload.unit as Holding['unit'],
    purchasePrice: decimalOrNull(payload.purchasePrice),
    currentValue: decimalOrNull(payload.currentValue),
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  });
}

/** domain `Holding` -> API `HoldingResponse` (decimal/date fields as wire strings). */
export function holdingToResponse(holding: Holding): HoldingResponse {
  return {
    id: holding.id,
    assetType: holding.assetType,
    management: holding.management,
    note: holding.note,
    isin: holding.isin,
    name: holding.name,
    metal: holding.metal,
    coinId: holding.coinId,
    quantity: holding.quantity?.toFixed() ?? null,
    unit: holding.unit,
    purchasePrice: holding.purchasePrice?.toFixed() ?? null,
    currentValue: holding.currentValue?.toFixed() ?? null,
    createdAt: holding.createdAt.toISOString(),
    updatedAt: holding.updatedAt.toISOString(),
  };
}

const str = (v: unknown): string | null | undefined => {
  if (typeof v === 'string') return v;
  return v == null ? undefined : String(v);
};

/**
 * Request body -> raw submission. Every field is passed through (not only the ones the asset type
 * allows) so the domain validation can reject non-applicable ones with FIELD_NOT_ALLOWED.
 */
export function requestToSubmission(
  assetType: AssetType,
  body: CreateHoldingRequest | UpdateHoldingRequest,
): HoldingSubmission {
  const b = body as unknown as Record<string, unknown>;
  return {
    assetType,
    management: typeof b.management === 'string' ? b.management : '',
    note: str(b.note),
    isin: str(b.isin),
    name: str(b.name),
    metal: str(b.metal),
    unit: str(b.unit),
    coinId: str(b.coinId),
    quantity: str(b.quantity),
    purchasePrice: str(b.purchasePrice),
    currentValue: str(b.currentValue),
  };
}
