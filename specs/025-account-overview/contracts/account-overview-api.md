# Contract: Account Overview API

Base path: `/account-overview/accounts` — behind `@RequiresDomain('account-overview')` (the
existing `AuthGuard`/`DomainGuard` run globally, per `AuthModule`), mirroring `/holdings`'s
`@RequiresDomain('holdings')`. Every request requires an authenticated session; every response is
scoped to the caller's `ownerId` (research.md #3) — a row belonging to another user is
indistinguishable from a non-existent one (404, not 403), matching the `holdings` precedent.

All types below live in `libs/api-contract/src/lib/account-overview.ts` and are imported by both
`apps/backend` and `apps/frontend` (Principle II).

## Types

```ts
export type AccountCategory = 'GENERAL' | 'LEISURE' | 'SAVINGS' | 'CREDIT_CARD' | 'OTHER';

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

/** PUT body — every field optional; an omitted field leaves its current stored value unchanged, an empty-string field clears it. `name`, if present, still cannot be blank (FR-006). */
export type UpdateAccountOverviewEntryRequest = Partial<CreateAccountOverviewEntryRequest>;

export interface AccountOverviewValidationErrorResponse {
  error: 'VALIDATION_FAILED';
  message: string;
  fieldErrors: { field: string; message: string }[];
}

export interface AccountOverviewNotFoundErrorResponse {
  error: 'ACCOUNT_NOT_FOUND';
  message: string;
}
```

## Endpoints

### `GET /account-overview/accounts`

Lists every account belonging to the caller, ordered by `created_at ASC` (matches `holdings`'
list ordering).

- **200** → `AccountOverviewEntry[]` (empty array when the user has none — FR-011's empty state is
  a frontend concern, not a distinct API shape).

### `POST /account-overview/accounts`

- **Body**: `CreateAccountOverviewEntryRequest`.
- **201** → `AccountOverviewEntry` (created).
- **400** → `AccountOverviewValidationErrorResponse` when `name` is missing/blank, or `category`
  is present but not one of the five known literals (FR-006).

### `PUT /account-overview/accounts/:id`

- **Body**: `UpdateAccountOverviewEntryRequest`.
- **200** → `AccountOverviewEntry` (updated) — every field in the body replaces the stored value;
  fields omitted from the body are left unchanged.
- **400** → `AccountOverviewValidationErrorResponse` (name present but blank, or unknown category).
- **404** → `AccountOverviewNotFoundErrorResponse` (no such id for this caller).

### `DELETE /account-overview/accounts/:id`

Hard delete, no soft-delete/undo (research.md #4) — the confirmation step (FR-005) is a frontend
concern (a `ConfirmDialog` before this call is made), not an API-level behavior.

- **204** → no body.
- **404** → `AccountOverviewNotFoundErrorResponse`.

## Error body consistency

Every non-2xx response uses one of the two structured shapes above — no bare exceptions or HTML
error pages (Principle II), matching `holdings-api.md`'s established contract shape exactly (only
the `error` discriminant strings differ: `ACCOUNT_NOT_FOUND` vs. `HOLDING_NOT_FOUND`).
