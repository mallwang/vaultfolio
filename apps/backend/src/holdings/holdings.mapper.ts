import Decimal from 'decimal.js';
import { Holding } from '@vaultfolio/domain-holdings';
import type { AssetType, ValidatedHolding } from '@vaultfolio/domain-holdings';
import type {
  CreateHoldingRequest,
  HoldingResponse,
  UpdateHoldingRequest,
} from '@vaultfolio/api-contract';

/** Raw `better-sqlite3` row shape for the `holdings` table (snake_case columns). */
export interface HoldingRow {
  id: string;
  asset_type: AssetType;
  management: string;
  quantity: string | null;
  purchase_price: string | null;
  purchase_date: Date | string | null;
  isin: string | null;
  name: string | null;
  weight_grams: string | null;
  current_value: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

function toDecimalOrNull(value: string | null): Decimal | null {
  return value == null ? null : new Decimal(value);
}

function toDateOnly(value: Date | string | null): Date | null {
  if (value == null) {
    return null;
  }
  return value instanceof Date ? value : new Date(value);
}

/** SQLite's `TEXT` timestamp columns come back as ISO-8601 strings, not `Date` (research.md #4). */
function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

/** DB row -> domain `Holding`. */
export function rowToHolding(row: HoldingRow): Holding {
  return new Holding({
    id: row.id,
    assetType: row.asset_type,
    management: row.management,
    quantity: toDecimalOrNull(row.quantity),
    purchasePrice: toDecimalOrNull(row.purchase_price),
    purchaseDate: toDateOnly(row.purchase_date),
    isin: row.isin,
    name: row.name,
    weightGrams: toDecimalOrNull(row.weight_grams),
    currentValue: toDecimalOrNull(row.current_value),
    createdAt: toDate(row.created_at),
    updatedAt: toDate(row.updated_at),
  });
}

function toIsoDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** domain `Holding` -> API `HoldingResponse` (decimal/date fields as wire strings). */
export function holdingToResponse(holding: Holding): HoldingResponse {
  return {
    id: holding.id,
    assetType: holding.assetType,
    management: holding.management,
    quantity: holding.quantity?.toString() ?? null,
    purchasePrice: holding.purchasePrice?.toString() ?? null,
    purchaseDate: holding.purchaseDate ? toIsoDateOnly(holding.purchaseDate) : null,
    isin: holding.isin,
    name: holding.name,
    weightGrams: holding.weightGrams?.toString() ?? null,
    currentValue: holding.currentValue?.toString() ?? null,
    createdAt: holding.createdAt.toISOString(),
    updatedAt: holding.updatedAt.toISOString(),
  };
}

/** POST /holdings body -> domain validation's raw submission shape. */
export function createRequestToSubmission(body: CreateHoldingRequest) {
  return requestToSubmission(body.assetType, body as unknown as Record<string, unknown>);
}

/** PUT /holdings/:id body (plus the holding's existing, immutable assetType) -> raw submission shape. */
export function updateRequestToSubmission(assetType: AssetType, body: UpdateHoldingRequest) {
  return requestToSubmission(assetType, body as unknown as Record<string, unknown>);
}

function requestToSubmission(
  assetType: AssetType,
  body: Record<string, unknown>,
): {
  assetType: AssetType;
  management: string;
  quantity?: string | null;
  purchasePrice?: string | null;
  purchaseDate?: string | null;
  isin?: string | null;
  name?: string | null;
  weightGrams?: string | null;
  currentValue?: string | null;
} {
  return {
    assetType,
    management: typeof body.management === 'string' ? body.management : '',
    quantity: typeof body.quantity === 'string' ? body.quantity : undefined,
    purchasePrice: typeof body.purchasePrice === 'string' ? body.purchasePrice : undefined,
    purchaseDate: typeof body.purchaseDate === 'string' ? body.purchaseDate : undefined,
    isin: typeof body.isin === 'string' ? body.isin : undefined,
    name: typeof body.name === 'string' ? body.name : undefined,
    weightGrams: typeof body.weightGrams === 'string' ? body.weightGrams : undefined,
    currentValue: typeof body.currentValue === 'string' ? body.currentValue : undefined,
  };
}

/** Validated submission -> the field set the repository persists (snake_case values, wire-ready). */
export function validatedHoldingToRow(value: ValidatedHolding): {
  asset_type: AssetType;
  management: string;
  quantity: string | null;
  purchase_price: string | null;
  purchase_date: string | null;
  isin: string | null;
  name: string | null;
  weight_grams: string | null;
  current_value: string | null;
} {
  return {
    asset_type: value.assetType,
    management: value.management,
    quantity: value.quantity?.toString() ?? null,
    purchase_price: value.purchasePrice?.toString() ?? null,
    purchase_date: value.purchaseDate ? toIsoDateOnly(value.purchaseDate) : null,
    isin: value.isin,
    name: value.name,
    weight_grams: value.weightGrams?.toString() ?? null,
    current_value: value.currentValue?.toString() ?? null,
  };
}
