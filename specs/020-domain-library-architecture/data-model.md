# Data Model: Domain Library Architecture

**Feature**: 020-domain-library-architecture | **Date**: 2026-09-05

## Domain (registry entry)

Static, code-defined (not persisted) — one entry per domain library that exists in the codebase.
Lives in `libs/frontend/domain-access` as `DOMAIN_REGISTRY: DomainDescriptor[]`.

| Field      | Type     | Notes                                                                                                                      |
| ---------- | -------- | -------------------------------------------------------------------------------------------------------------------------- |
| `id`       | `string` | Stable key, e.g. `'holdings'`. Matches the value stored in a user's `domainScopes` and the Nx project/library name suffix. |
| `labelKey` | `string` | i18n translation key for the nav label, e.g. `'nav.holdings'`.                                                             |
| `path`     | `string` | Router path segment under `/app`, e.g. `'holdings'`.                                                                       |
| `icon`     | `string` | `vf-icon` semantic name, matching `ApplicationArea.icon`'s existing convention.                                            |

Relationship: `ApplicationArea` (existing, `application-areas.ts`) gains an optional `domainId?: string`
pointing at a `DomainDescriptor.id`, so the sidebar's existing rendering loop can additionally consult
`isDomainEntitled` for domain-gated areas the same way it already consults `roles` for role-gated ones.

## Domain Entitlement (Scope)

Not a standalone entity — represented as a field on the existing `User`/`SessionUser` records.

### `users` table (backend, SQLite)

| Column          | Type   | Notes                                                                                                                                                                                                                                                                                                                |
| --------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `domain_scopes` | `TEXT` | Nullable. JSON array of domain ids the user is entitled to, e.g. `["holdings"]`. `NULL`/`'[]'` means no non-admin domain access. Existing rows backfilled to `'["holdings"]'` at table-creation time so current access is unchanged (FR-009). Does not replace or interact with the existing `role` column (FR-007). |

No new table: a JSON column is sufficient for the current cardinality (one domain today, a handful
expected — research.md #5); no relational queries across users×domains are needed.

### `SessionUser` (`@vaultfolio/api-contract`)

```ts
export interface SessionUser {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  domainScopes: string[]; // NEW — domain ids this user is entitled to, independent of `role`
}
```

Populated by `AuthService` wherever a `SessionUser` is currently assembled (sign-in response, session
bootstrap `GET /api/auth/session`) by parsing the user row's `domain_scopes` JSON column.

### `AccountSummary` (`@vaultfolio/api-contract`, admin Accounts screen)

Gains the same `domainScopes: string[]` field, so the existing admin Accounts list/edit UI can display
and update it via the new `PATCH /accounts/:id/domain-scopes` endpoint (research.md #6).

## Entitlement evaluation (no new persisted entity — one function)

`isDomainEntitled(user: SessionUser | null, domainId: string): boolean` in
`libs/frontend/domain-access`:

- `false` if `user` is `null` (unauthenticated — the route guard's `authGuard` already handles this
  upstream, but the function stays total).
- `true` if `user.role === 'ADMIN'` (FR-008 — admins retain access to every existing domain by
  default; this is evaluated dynamically, not by backfilling every domain id into every admin's
  `domainScopes` row, so a _future_ domain is automatically visible to admins the moment it's
  registered in `DOMAIN_REGISTRY`, satisfying the Edge Case's "administrators… except" carve-out
  without any data migration per new domain).
- Otherwise `true` iff `domainId` is in `user.domainScopes`.

This single function is the one place SC-003 requires — both `domainGuard(domainId)` (route
protection) and the sidebar's nav filter call it; neither re-implements the check.

## Validation rules

- `domain_scopes` JSON, when present, MUST decode to an array of strings; unknown/legacy malformed
  values are treated as `[]` (fail closed — no domain access — never fail open).
- `PATCH /accounts/:id/domain-scopes` MUST reject any domain id not present in `DOMAIN_REGISTRY`
  (mirrors the existing `role` column's `CHECK (role IN (...))` intent, enforced at the application
  layer since SQLite `TEXT` can't `CHECK` against a code-level registry).

## State transitions

- A user's `domainScopes` changes only via the admin-initiated `PATCH /accounts/:id/domain-scopes`
  call. Per the spec's Edge Cases, a change takes effect on the affected user's next
  navigation/route evaluation — the frontend does not push a live update to an active session
  (`SessionUser` is refreshed the same way it already is today: on next `GET /api/auth/session`
  bootstrap or sign-in).
