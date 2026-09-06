/**
 * Shared contract for the Account Overview API — see
 * specs/025-account-overview/contracts/account-overview-api.md and
 * data-model.md's "Shared API contract types" section. Plain TypeScript
 * interfaces, no runtime dependency, imported by both `apps/backend` and
 * `apps/frontend` so the two tiers can never silently drift on shape
 * (Principle II).
 *
 * This is a distinct file from `accounts.ts` in this library, which is
 * feature 006's admin _user_-accounts contract — an unrelated entity that
 * happens to share the English word "account" (plan.md's Constitution
 * Check). No monetary values exist here at all (FR-012) — every field is
 * plain text.
 */

export type AccountCategory = 'GENERAL' | 'LEISURE' | 'SAVINGS' | 'CREDIT_CARD' | 'OTHER';

/** The full shape returned by GET/POST/PUT — same shape as a list item. */
export interface AccountOverviewEntry {
  id: string;
  name: string;
  category: AccountCategory;
  provider: string | null;
  website: string | null;
  purpose: string | null;
  cardUsage: string | null;
  requiredMinimum: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

/** POST /account-overview/accounts request body. */
export interface CreateAccountOverviewEntryRequest {
  name: string;
  /** Omit to default to 'OTHER' (FR-007/FR-008). */
  category?: AccountCategory;
  provider?: string;
  website?: string;
  purpose?: string;
  cardUsage?: string;
  requiredMinimum?: string;
  notes?: string;
}

/**
 * PUT /account-overview/accounts/:id request body — every field optional; an
 * omitted field leaves its current stored value unchanged, an empty-string
 * field clears it. `name`, if present, still cannot be blank (FR-006).
 */
export type UpdateAccountOverviewEntryRequest = Partial<CreateAccountOverviewEntryRequest>;

/** Structured 400 body shape shared by POST/PUT validation failures. */
export interface AccountOverviewValidationErrorResponse {
  error: 'VALIDATION_FAILED';
  message: string;
  fieldErrors: { field: string; message: string }[];
}

/** Structured 404 body shape shared by PUT/DELETE. */
export interface AccountOverviewNotFoundErrorResponse {
  error: 'ACCOUNT_NOT_FOUND';
  message: string;
}
