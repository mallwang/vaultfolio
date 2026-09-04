# Contract Amendment: Holdings API — Deposit Money asset type

Amends [003-manual-holdings-entry/contracts/holdings-api.md](../../003-manual-holdings-entry/contracts/holdings-api.md),
as previously amended by [017-restructure-asset-types/contracts/holdings-api-asset-types.md](../../017-restructure-asset-types/contracts/holdings-api-asset-types.md).
Only the pieces that change are documented here; every endpoint's purpose, status codes, and
error-format conventions are otherwise unchanged and not repeated.

**Versioning** (Principle V): this is an additive, backward-compatible change — no existing
`assetType` value, request shape, or response field is removed or altered in meaning; a new
`assetType` value and its own request shape are added, and one existing validation rule is widened
(`currentValue` now accepts `0`, previously required `> 0`, for every type that already used it).
The Holdings API contract moves from `2.0.0` to **`2.1.0`**.

## `GET /holdings`

Same endpoint and shape. `assetType` may now also be `'DEPOSIT_MONEY'`:

```json
[
  {
    "id": "c4f1...",
    "assetType": "DEPOSIT_MONEY",
    "management": "N26",
    "isin": null,
    "name": "Checking",
    "quantity": null,
    "purchasePrice": null,
    "purchaseDate": null,
    "weightGrams": null,
    "currentValue": "1250.00",
    "createdAt": "2026-09-04T09:00:00.000Z",
    "updatedAt": "2026-09-04T09:00:00.000Z"
  }
]
```

## `POST /holdings`

**Request body** — new `DEPOSIT_MONEY` shape:

```json
{
  "assetType": "DEPOSIT_MONEY",
  "management": "N26",
  "name": "Checking",
  "currentValue": "1250.00"
}
```

**Upsert semantics** (FR-008): a `DEPOSIT_MONEY` submission whose `(name, management)` matches an
existing `DEPOSIT_MONEY` row replaces that row's `currentValue` in place instead of inserting a new
one — same rule already applied to `PRECIOUS_METAL`.

**Validation** (FR-002, FR-004, FR-005, FR-006, FR-007):

- `management`, `name`, `currentValue` are required; missing any one is reported by field name.
- `isin`, `quantity`, `purchasePrice`, `purchaseDate`, `weightGrams` MUST be omitted — sending any
  of them is a `400` naming that field, as with every other type's inapplicable fields.
- `currentValue` MUST be a non-negative decimal string. `"0"`/`"0.00"` is accepted (FR-007);
  a negative value is rejected (FR-006):
  ```json
  {
    "error": "VALIDATION_FAILED",
    "message": "Validation failed.",
    "fieldErrors": [
      { "field": "currentValue", "message": "currentValue must be a non-negative number." }
    ]
  }
  ```

**Widened rule** (applies to every type that uses `currentValue`, i.e. `DEPOSIT_MONEY` and
`PRECIOUS_METAL`): `currentValue: "0"` is now accepted where it previously would have been rejected
as not `> 0`.

## `PUT /holdings/:id`

Same shape as the `POST` body, without `assetType` (immutable). Updating a `DEPOSIT_MONEY`
holding's `currentValue` (including to `"0"`) is the primary path for User Story 2.

## `DELETE /holdings/:id`

Unchanged — works identically for `DEPOSIT_MONEY` as for every other type.
