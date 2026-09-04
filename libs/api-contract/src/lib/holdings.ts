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

export type AssetType = 'ETF' | 'SHARE' | 'PRECIOUS_METAL' | 'CRYPTO';

/** The full shape returned by GET/POST/PUT — same shape as a list item. */
export interface HoldingResponse {
  id: string;
  assetType: AssetType;
  management: string;
  quantity: string | null;
  purchasePrice: string | null;
  purchaseDate: string | null;
  isin: string | null;
  name: string | null;
  weightGrams: string | null;
  currentValue: string | null;
  createdAt: string;
  updatedAt: string;
}

interface CreateEtfHoldingRequest {
  assetType: 'ETF';
  management: string;
  isin: string;
  name: string;
  quantity: string;
  purchasePrice: string;
}

interface CreateShareHoldingRequest {
  assetType: 'SHARE';
  management: string;
  isin: string;
  name: string;
  quantity: string;
  purchasePrice: string;
  /** Optional — omit entirely, not "". */
  purchaseDate?: string;
}

interface CreatePreciousMetalHoldingRequest {
  assetType: 'PRECIOUS_METAL';
  management: string;
  name: string;
  weightGrams: string;
  /** Optional — used only by the distribution view (FR-012a). */
  currentValue?: string;
}

interface CreateCryptoHoldingRequest {
  assetType: 'CRYPTO';
  management: string;
  name: string;
  quantity: string;
  purchasePrice: string;
  /** Optional — omit entirely, not "". */
  purchaseDate?: string;
}

/** POST /holdings request body — shape depends on `assetType` (FR-001–FR-007). */
export type CreateHoldingRequest =
  | CreateEtfHoldingRequest
  | CreateShareHoldingRequest
  | CreatePreciousMetalHoldingRequest
  | CreateCryptoHoldingRequest;

/**
 * PUT /holdings/:id request body — same shape as the matching `POST` body,
 * without `assetType` (immutable after creation, FR-008).
 */
export type UpdateHoldingRequest =
  | Omit<CreateEtfHoldingRequest, 'assetType'>
  | Omit<CreateShareHoldingRequest, 'assetType'>
  | Omit<CreatePreciousMetalHoldingRequest, 'assetType'>
  | Omit<CreateCryptoHoldingRequest, 'assetType'>;

/** Structured 400 body shape shared by POST/PUT validation failures. */
export interface HoldingValidationErrorResponse {
  error: 'VALIDATION_FAILED';
  message: string;
  fieldErrors: { field: string; message: string }[];
}

/** Structured 404 body shape shared by PUT/DELETE. */
export interface HoldingNotFoundErrorResponse {
  error: 'HOLDING_NOT_FOUND';
  message: string;
}
