# Contract: Wealth REST API

All routes require a signed-in session (global `AuthGuard`) and
`@RequiresDomain('historic-wealth-development')` (admins pass, members need the domain in their
`domainScopes`). `WealthAvailableGuard` then answers `503 WEALTH_UNAVAILABLE` on every route while
`WEALTH_ENCRYPTION_KEY` is missing, invalid or does not match the stored data. Every route reads and
writes **only the caller's own data**; another owner's id behaves like a missing id. Request bodies
are validated by the strict whitelist in `@vaultfolio/wealth`; types live in
`@vaultfolio/api-contract` (`wealth.ts`). Logs contain snapshot id, entry count and outcome, never
names, classes or amounts.

## Error body

Same shape as the other domains (`ErrorResponseDto`): `{ error, message, details? }`. Validation
details name the field only: `details: [{ field, message: <CODE> }]`.

| Status | `error`                       | When                                                                   |
| ------ | ----------------------------- | ---------------------------------------------------------------------- |
| 400    | `WEALTH_VALIDATION`           | missing or invalid value, negative amount, future date, no entries     |
| 400    | `WEALTH_UNKNOWN_FIELD`        | field outside the whitelist, or standard class/group on the wrong side |
| 400    | `WEALTH_LIMIT_EXCEEDED`       | more than 600 snapshots or 200 entries                                 |
| 403    | `FORBIDDEN`                   | domain not entitled                                                    |
| 404    | `WEALTH_SNAPSHOT_NOT_FOUND`   | unknown id or id of another owner                                      |
| 409    | `WEALTH_SNAPSHOT_DATE_EXISTS` | a snapshot for that date exists; body adds `existingId`                |
| 503    | `WEALTH_UNAVAILABLE`          | key missing or invalid                                                 |

## Types

```text
Money      = string                       // "12000.00"
ClassRef   = { standard: string } | { custom: string }
WealthEntry = { side: 'ASSET' | 'LIABILITY', class: ClassRef, name: string, amount: Money }
WealthSnapshot = { id, snapshotDate: 'YYYY-MM-DD', note?: string, entries: WealthEntry[],
                   createdAt, updatedAt }
WealthSnapshotInput = { snapshotDate, note?, entries: WealthEntry[] }          // no id, no timestamps
ClassGroupAssignment = { side, class: ClassRef, group: BalanceGroup }
WealthSettings = { classGroups: ClassGroupAssignment[] }
```

No totals appear in any response; they are derived in `@vaultfolio/wealth`.

## Routes

### `GET /wealth/snapshots` → `WealthSnapshot[]`

All snapshots of the caller, ascending by `snapshotDate`, entries included. Empty owner → `[]`.

### `GET /wealth/snapshots/:id` → `WealthSnapshot`

### `POST /wealth/snapshots` → `201 WealthSnapshot`

Body `WealthSnapshotInput`. Errors: 400s, `409 WEALTH_SNAPSHOT_DATE_EXISTS`.

### `PUT /wealth/snapshots/:id` → `WealthSnapshot`

Replaces date, note and entries as a whole. A changed date re-checks uniqueness (`409` if it
collides with another snapshot). Errors: 400s, 404, 409.

### `DELETE /wealth/snapshots/:id` → `204`

### `GET /wealth/settings` → `WealthSettings`

Only explicit assignments; defaults for standard classes are applied by the lib, not stored.
Empty owner → `{ classGroups: [] }`.

### `PUT /wealth/settings/class-groups` → `WealthSettings`

Body `ClassGroupAssignment`. Upserts the assignment for `(side, class identity)` and returns the new
settings. Group on the wrong side → `400 WEALTH_UNKNOWN_FIELD`.

### `DELETE /wealth` → `204`

Deletes all snapshots and the settings row of the caller (danger zone; the account-deletion path
does the same).

## Not in the contract

No bulk or CSV import, no totals or series endpoint, no Holdings read, no per-entry routes.
OpenAPI drift and completeness checks cover every route above.
