# Contract Amendment: Holdings API — Precious Metal / Crypto rename

Amends [003-manual-holdings-entry/contracts/holdings-api.md](../../003-manual-holdings-entry/contracts/holdings-api.md)
in place. Only the pieces that change are documented here; every endpoint's purpose, status codes,
and error-format conventions are otherwise unchanged and not repeated.

**Versioning** (Principle V): this is a breaking change — an `assetType` value (`GOLD`, `BITCOIN`)
that a `201`/`200` response could previously return is no longer produced, and a request body a
client could previously send (`assetType: "GOLD"` with no `name`) is no longer accepted (FR-011).
The Holdings API contract moves from `1.0.0` to **`2.0.0`**.

## `GET /holdings`

Same endpoint, shape, and empty-list behavior as before. `assetType` values in the response now
come from `{'ETF','SHARE','PRECIOUS_METAL','CRYPTO'}` instead of `{'ETF','SHARE','GOLD','BITCOIN'}`,
and every `PRECIOUS_METAL`/`CRYPTO` item's `name` is non-null (previously always `null` for
`GOLD`/`BITCOIN`):

```json
[
  {
    "id": "9a2e...",
    "assetType": "PRECIOUS_METAL",
    "management": "Private",
    "isin": null,
    "name": "Gold",
    "quantity": null,
    "purchasePrice": null,
    "purchaseDate": null,
    "weightGrams": "31.1",
    "currentValue": "2450.00",
    "createdAt": "2026-08-10T09:00:00.000Z",
    "updatedAt": "2026-08-10T09:00:00.000Z"
  }
]
```

## `POST /holdings`

Same upsert semantics as before (FR-011a lineage), restated for the renamed types: every call for
`SHARE`/`CRYPTO` creates an independent new row. A call for `ETF` (unchanged) or `PRECIOUS_METAL`
whose `(isin, management)` (ETF) or **`(name, management)`** (Precious metal — was `(management)`
alone for Gold, FR-005) matches an existing row replaces that row in place instead of inserting a
new one.

**Request body** — `PRECIOUS_METAL` and `CRYPTO` shapes, replacing `GOLD`/`BITCOIN`; `ETF`/`SHARE`
shapes are unchanged from 003's contract:

```json
// PRECIOUS_METAL — name is new and required; weightGrams/currentValue unchanged from GOLD
{
  "assetType": "PRECIOUS_METAL",
  "management": "Private",
  "name": "Silver",
  "weightGrams": "500",
  "currentValue": "410.00" // optional — used only by the distribution view (FR-012a)
}
```

```json
// CRYPTO — name is new and required; quantity/purchasePrice/purchaseDate unchanged from BITCOIN
{
  "assetType": "CRYPTO",
  "management": "Private",
  "name": "Ethereum",
  "quantity": "6.4",
  "purchasePrice": "3150.00",
  "purchaseDate": "2026-03-01" // optional
}
```

**Response — 400 Bad Request** (new failure case): an empty/whitespace-only `name` for
`PRECIOUS_METAL`/`CRYPTO` now produces a field error (FR-009, SC-004), the same shape as every
other field error:

```json
{
  "error": "VALIDATION_FAILED",
  "message": "One or more fields are invalid.",
  "fieldErrors": [{ "field": "name", "message": "name is required for CRYPTO." }]
}
```

Everything else about `POST /holdings` (201 vs. 200 semantics, the general 400 shape,
contract-test expectations) is unchanged — see 003's contract doc — except that the ETF/Gold
upsert contract test's Gold case becomes a Precious metal case asserting the new
`(name, management)` key: two `PRECIOUS_METAL` submissions with the same `management` but
different `name` ("Gold" vs. "Silver") both return `201` (two rows, not a merge), while two
submissions with the same `management` **and** `name` return `201` then `200` (merge), per FR-005.

## `PUT /holdings/:id`

Unchanged endpoint and semantics. Request body shape for `PRECIOUS_METAL`/`CRYPTO` holdings now
includes `name` (editable, alongside `management`/the type's other fields) — `assetType` remains
immutable and unaccepted, as before.

## `DELETE /holdings/:id`

Unchanged.

## Removed request/response values

- `assetType: "GOLD"` and `assetType: "BITCOIN"` are no longer valid in any request body — a
  `POST`/`PUT` using either value now returns `400` with a field error on `assetType` (extending
  the existing "not a recognized asset type" rejection path, not a new one) (FR-011).
- No endpoint returns `"GOLD"`/`"BITCOIN"` in a response body once the startup migration
  (data-model.md's Persistence section) has run.
