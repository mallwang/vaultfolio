/**
 * Shared contract for the Holdings API — see
 * specs/003-manual-holdings-entry/contracts/holdings-api.md and data-model.md's
 * "Shared API contract types" section. Plain TypeScript interfaces, no
 * runtime dependency, imported by both `apps/backend` and `apps/frontend` so
 * the two tiers can never silently drift on shape (Principle II).
 *
 * All monetary/quantity fields are transmitted as decimal strings (e.g.
 * `"1.5"`), never JSON numbers, so precision is never lost before reaching
 * the `Decimal` type at either tier (constitution's Money/decimal handling
 * clause).
 */

export type AssetType = 'ETF' | 'SHARE' | 'PRECIOUS_METAL' | 'CRYPTO' | 'DEPOSIT_MONEY';

export type HoldingMetal = 'XAU' | 'XAG' | 'XPT' | 'XPD';
export type HoldingQuantityUnit = 'G' | 'OZT';

/** The full shape returned by GET/POST/PUT; inapplicable fields are `null`. */
export interface HoldingResponse {
  id: string;
  assetType: AssetType;
  management: string;
  note: string | null;
  isin: string | null;
  name: string | null;
  metal: HoldingMetal | null;
  coinId: string | null;
  quantity: string | null;
  unit: HoldingQuantityUnit | null;
  purchasePrice: string | null;
  currentValue: string | null;
  createdAt: string;
  updatedAt: string;
}

interface CreateEtfHoldingRequest {
  assetType: 'ETF';
  management: string;
  /** Optional, at most 500 characters. */
  note?: string;
  isin: string;
  name: string;
  quantity: string;
  purchasePrice: string;
}

interface CreateShareHoldingRequest {
  assetType: 'SHARE';
  management: string;
  note?: string;
  isin: string;
  name: string;
  quantity: string;
  purchasePrice: string;
}

interface CreatePreciousMetalHoldingRequest {
  assetType: 'PRECIOUS_METAL';
  management: string;
  note?: string;
  metal: HoldingMetal;
  quantity: string;
  unit: HoldingQuantityUnit;
  /** Purchase price per unit. */
  purchasePrice: string;
}

interface CreateCryptoHoldingRequest {
  assetType: 'CRYPTO';
  management: string;
  note?: string;
  /** Catalogue id (CoinGecko). */
  coinId: string;
  /** At most 8 decimals. */
  quantity: string;
  purchasePrice: string;
}

interface CreateDepositMoneyHoldingRequest {
  assetType: 'DEPOSIT_MONEY';
  management: string;
  note?: string;
  name: string;
  currentValue: string;
}

/** POST /holdings request body; shape depends on `assetType`. */
export type CreateHoldingRequest =
  | CreateEtfHoldingRequest
  | CreateShareHoldingRequest
  | CreatePreciousMetalHoldingRequest
  | CreateCryptoHoldingRequest
  | CreateDepositMoneyHoldingRequest;

/** PUT /holdings/:id body: same as POST without `assetType` (immutable). */
export type UpdateHoldingRequest =
  | Omit<CreateEtfHoldingRequest, 'assetType'>
  | Omit<CreateShareHoldingRequest, 'assetType'>
  | Omit<CreatePreciousMetalHoldingRequest, 'assetType'>
  | Omit<CreateCryptoHoldingRequest, 'assetType'>
  | Omit<CreateDepositMoneyHoldingRequest, 'assetType'>;

/** 400 body for POST/PUT validation failures; `code` is a domain `HoldingErrorCode`. */
export interface HoldingValidationErrorResponse {
  message: string;
  errors: { field: string; code: string }[];
}

/** Structured 404 body shape shared by PUT/DELETE. */
export interface HoldingNotFoundErrorResponse {
  error: 'HOLDING_NOT_FOUND';
  message: string;
}
