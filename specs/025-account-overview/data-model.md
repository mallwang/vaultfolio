# Data Model: Account Overview

## Account

The core entity (spec.md's "Account" Key Entity) — one row per bank, neobroker, depot, credit
card, or similar reference-only container. Framework-independent domain shape lives in
`libs/domain/accounts/src/lib/account.ts`, mirroring `libs/domain/holdings`'s `Holding` class.

| Field             | Type              | Required        | Notes                                                                                                             |
| ----------------- | ----------------- | --------------- | ----------------------------------------------------------------------------------------------------------------- |
| `id`              | `string` (UUID)   | generated       | `randomUUID()` at creation, never client-supplied (matches `Holding.id`).                                         |
| `name`            | `string`          | **yes**         | Non-empty after trimming (FR-006). The only required field.                                                       |
| `category`        | `AccountCategory` | yes (defaulted) | One of `GENERAL \| LEISURE \| SAVINGS \| CREDIT_CARD \| OTHER`; defaults to `OTHER` when omitted (FR-007/FR-008). |
| `provider`        | `string \| null`  | no              | Institution/provider name, free text.                                                                             |
| `website`         | `string \| null`  | no              | Stored and displayed as entered, not validated as a live/reachable URL (Edge Cases).                              |
| `purpose`         | `string \| null`  | no              | Free text describing what the account is for.                                                                     |
| `cardUsage`       | `string \| null`  | no              | Named detail field (research.md #2), e.g. "contactless only, no online purchases".                                |
| `requiredMinimum` | `string \| null`  | no              | Named detail field (research.md #2), e.g. "€500 minimum balance".                                                 |
| `notes`           | `string \| null`  | no              | General free-text catch-all, for anything not covered by the named fields above.                                  |
| `ownerId`         | `string \| null`  | n/a             | Set by the backend from the authenticated session (research.md #3); never client-supplied.                        |
| `createdAt`       | `Date`            | generated       | Set at insert.                                                                                                    |
| `updatedAt`       | `Date`            | generated       | Refreshed on every update.                                                                                        |

### Validation rules (`account-validation.ts`, mirrors `holding-validation.ts`'s shape)

- `name`: required; rejected with a `FieldError` (`{ field: 'name', message }`) when empty/blank
  after trimming (FR-006). This is the _only_ required-field rule (FR-003 — every other field is
  optional).
- `category`: if present, must be one of the five known literals; an unrecognized value is
  rejected the same way (defensive server-side check, matching `holdings`' "a defensive server
  rejects them if present" precedent) — a well-behaved client only ever sends a known literal or
  omits the field.
- `website`, `provider`, `purpose`, `cardUsage`, `requiredMinimum`, `notes`: no format validation —
  stored exactly as submitted (Edge Cases: "must still display and save it as entered").
- Every optional string field is trimmed; an empty string after trimming is normalized to `null`
  (so a field left blank in the form is never persisted as `""` vs. `null` inconsistently).

### State transitions

None — an `Account` has no lifecycle/status field. Create, edit-in-place (any subset of fields),
and hard delete are the only transitions (FR-003/FR-004/FR-005). Unlike `Holding`, there is no
upsert-matching behavior — every "add account" submission always inserts a new row (Edge Cases:
duplicate names, e.g. two accounts both called "Savings", are explicitly allowed).

## AccountCategory

Not a table — a fixed literal union (research.md #1), defined once in
`libs/domain/accounts/src/lib/account-category.ts` and re-exported through the domain lib's
`index.ts` so both the backend validation and (via `@vaultfolio/api-contract`) the frontend Select
component and grouping logic share the same source of truth and display order.

```ts
export type AccountCategory = 'GENERAL' | 'LEISURE' | 'SAVINGS' | 'CREDIT_CARD' | 'OTHER';

// Fixed display/grouping order (design.md): General → Leisure → Savings → Credit Card → Other.
export const ACCOUNT_CATEGORIES: readonly AccountCategory[] = [
  'GENERAL',
  'LEISURE',
  'SAVINGS',
  'CREDIT_CARD',
  'OTHER',
];
```

## SQLite schema (`accounts` table, added to `DatabaseService.initializeSchema()`)

```sql
CREATE TABLE IF NOT EXISTS accounts (
  id                TEXT PRIMARY KEY,
  name              TEXT NOT NULL CHECK (name <> ''),
  category          TEXT NOT NULL CHECK (category IN ('GENERAL','LEISURE','SAVINGS','CREDIT_CARD','OTHER')) DEFAULT 'OTHER',
  provider          TEXT NULL,
  website           TEXT NULL,
  purpose           TEXT NULL,
  card_usage        TEXT NULL,
  required_minimum  TEXT NULL,
  notes             TEXT NULL,
  owner_id          TEXT NULL,
  created_at        TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at        TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS accounts_owner_id_idx ON accounts (owner_id);
```

No uniqueness constraint on `(name)` or `(name, category)` — duplicate names are explicitly
allowed (Edge Cases). No foreign keys beyond the implicit `owner_id` → `users.id` relationship
(left unenforced at the DB layer, matching `holdings.owner_id`'s precedent — the column is
nullable and not `REFERENCES users(id)`).

## Shared API contract types (`libs/api-contract/src/lib/account-overview.ts`)

See [contracts/account-overview-api.md](contracts/account-overview-api.md) for the full request/
response shapes. Summary of the exported types:

- `AccountOverviewEntry` — the full response shape (GET list item / POST / PUT response).
- `CreateAccountOverviewEntryRequest` — `{ name: string; category?: AccountCategory; provider?:
string; website?: string; purpose?: string; cardUsage?: string; requiredMinimum?: string; notes?:
string }`.
- `UpdateAccountOverviewEntryRequest` — same shape as create (category still optional; omitting it
  on an edit leaves the existing category unchanged — see contracts doc).
- `AccountOverviewValidationErrorResponse` — `{ error: 'VALIDATION_FAILED'; message: string;
fieldErrors: { field: string; message: string }[] }`.
- `AccountOverviewNotFoundErrorResponse` — `{ error: 'ACCOUNT_NOT_FOUND'; message: string }`.
