# Contract: Holdings API

The REST surface introduced by this feature. Defined here as the authoritative contract; the
shared TypeScript types in `libs/api-contract/src/lib/holdings.ts` (see
[data-model.md](../data-model.md)) are the implementation of this contract and MUST stay in sync
with it, per Principle II.

All monetary/quantity fields (`quantity`, `purchasePrice`, `weightGrams`, `currentValue`) are
transmitted as **decimal strings** (e.g. `"1.5"`), never JSON numbers, so precision is never lost
to JSON's floating-point number representation before reaching the `Decimal` type at either tier
(constitution's Money/decimal handling clause).

## `GET /holdings`

**Purpose**: Lists every holding, satisfying FR-012 (User Story 2). No filtering/pagination
parameters in this version — the client fetches the full list and renders it, and derives the
FR-012a distribution view, client-side (see research.md #6 on scale assumptions).

**Request**: No parameters, no body.

**Response — 200 OK**:

```json
[
  {
    "id": "b3d1c2e4-...",
    "assetType": "ETF",
    "management": "Roboadvisor",
    "isin": "IE00B4L5Y983",
    "name": "iShares Core MSCI World",
    "quantity": "12.5",
    "purchasePrice": "78.42",
    "purchaseDate": null,
    "weightGrams": null,
    "currentValue": null,
    "createdAt": "2026-08-01T09:00:00.000Z",
    "updatedAt": "2026-08-28T09:00:00.000Z"
  },
  {
    "id": "9a2e...",
    "assetType": "GOLD",
    "management": "Private",
    "isin": null,
    "name": null,
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

An empty portfolio returns `200 OK` with `[]` (not a 404) — the frontend renders the empty state
(FR-013) from an empty array, distinct from a loading/error state.

## `POST /holdings`

**Purpose**: Creates or, for ETF/Gold, updates-in-place a holding (FR-001–FR-011a, User Story 1).
Every call for `SHARE`/`BITCOIN` creates an independent new row (FR-011). A call for `ETF`/`GOLD`
whose `(isin, management)` (ETF) or `(management)` (Gold) matches an existing row **replaces**
that row's quantity/price/weight/currentValue in place instead of inserting a new one (FR-011a,
data-model.md's merge rule) — the request body and shape are otherwise identical to the "create a
new one" case; the server decides whether it was a create or an update.

**Request body** (`CreateHoldingRequest`) — shape depends on `assetType`; `management` is required
on every shape. Fields not applicable to the chosen type MUST be omitted (a well-behaved client)
and MUST be ignored/rejected if present (a defensive server, per FR-008/Edge Cases):

```json
// ETF — note: no purchaseDate field at all
{
  "assetType": "ETF",
  "management": "Roboadvisor",
  "isin": "IE00B4L5Y983",
  "name": "iShares Core MSCI World",
  "quantity": "12.5",
  "purchasePrice": "78.42"
}
```

```json
// SHARE
{
  "assetType": "SHARE",
  "management": "Private",
  "isin": "US0378331005",
  "name": "Apple Inc.",
  "quantity": "10",
  "purchasePrice": "150.00",
  "purchaseDate": "2026-03-01" // optional — omit entirely, not ""
}
```

```json
// GOLD — note: no isin/name/purchasePrice/purchaseDate; currentValue is optional
{
  "assetType": "GOLD",
  "management": "Private",
  "weightGrams": "31.1",
  "currentValue": "2450.00" // optional — used only by the distribution view (FR-012a)
}
```

```json
// BITCOIN
{
  "assetType": "BITCOIN",
  "management": "Private",
  "quantity": "0.25",
  "purchasePrice": "42000.00",
  "purchaseDate": "2026-03-01" // optional
}
```

**Response — 201 Created**: A new row was inserted (always for Share/Bitcoin; for ETF/Gold, only
when no existing `(identifier, management)` match was found). Body is the full `HoldingResponse`
(same shape as a `GET /holdings` list item), including the server-generated `id`, `createdAt`,
`updatedAt`.

**Response — 200 OK**: An existing ETF or Gold row was matched and updated in place (FR-011a).
Body is the full `HoldingResponse` for the updated row — same `id`/`createdAt` as before, new
`quantity`/`purchasePrice` (ETF) or `weightGrams`/`currentValue` (Gold), bumped `updatedAt`.

**Response — 400 Bad Request** (validation failure — FR-009, FR-010, SC-002): structured body
identifying every failing field, not just the first:

```json
{
  "error": "VALIDATION_FAILED",
  "message": "One or more fields are invalid.",
  "fieldErrors": [
    { "field": "quantity", "message": "Quantity must be a positive number." },
    { "field": "management", "message": "Management is required." }
  ]
}
```

**Contract test**: An integration test in `apps/backend/src/tests/holdings.e2e-spec.ts` issues a
real HTTP `POST` (via `supertest`) for each asset type with valid data and asserts the `201`
response shape; issues a second matching `POST` for ETF and Gold and asserts a `200` response with
the same `id` and replaced values (not a second row on a subsequent `GET`); issues a second
matching `POST` for Share/Bitcoin and asserts a second `201` with a distinct `id` (no merge); and
for each Edge Case (negative quantity, future date, malformed ISIN, missing Management, extraneous
fields for the wrong type) asserts the exact `400` shape, per Principle IV.

## `PUT /holdings/:id`

**Purpose**: Edits an existing holding's fields in place (FR-014, User Story 3). `assetType` is
immutable — it is not accepted in the request body; the field set accepted is the same as
`POST /holdings` minus `assetType`, scoped to the holding's own existing type (FR-008). Unlike
`POST`, `PUT` targets a specific `id` directly and never performs the identifier-based upsert
lookup described above — it always edits the row at `:id`.

**Request body** (`UpdateHoldingRequest`): same shape as the matching `POST` body, without
`assetType`.

**Response — 200 OK**: The updated `HoldingResponse`.

**Response — 400 Bad Request**: Same shape as `POST /holdings`'s validation error.

**Response — 404 Not Found**: The holding does not exist (e.g., already deleted in another
session):

```json
{ "error": "HOLDING_NOT_FOUND", "message": "This holding no longer exists." }
```

**Contract test**: `holdings.e2e-spec.ts` creates a holding, edits one field, asserts the updated
value round-trips on a subsequent `GET`, and asserts other holdings are untouched (FR-014's
"without altering any previously saved holding").

## `DELETE /holdings/:id`

**Purpose**: Permanently removes a holding after client-side confirmation (FR-016, User Story 4).
Hard delete — no soft-delete/undo (spec.md Assumptions).

**Request**: No body.

**Response — 204 No Content**: Deletion succeeded.

**Response — 404 Not Found**: Same shape as `PUT`'s 404 — covers the "already deleted in another
tab" Edge Case. The frontend treats this as a successful outcome from the user's perspective (the
holding is gone either way) and refreshes the list rather than surfacing an error (research.md
#7).

**Contract test**: `holdings.e2e-spec.ts` creates and deletes a holding, asserts `204` then asserts
a subsequent `GET /holdings` no longer includes it, and asserts a second `DELETE` of the same `id`
returns `404`.

## Error format

All error responses share the `{ "error": "<MACHINE_CODE>", "message": "<human summary>", ... }`
shape (Principle II: "consistent, structured responses ... not bare exceptions or HTML error
pages"), matching the precedent set by `GET /health`'s structured 503 body.

## Versioning

This is the first version of this contract. Per Principle V (MAJOR.MINOR.BUILD versioning for
external-facing contracts), it is implicitly `1.0.0`. Any breaking change (field removal/rename,
status code semantics change, new required request field) requires a MAJOR bump and a documented
migration note in this file's future revisions.
