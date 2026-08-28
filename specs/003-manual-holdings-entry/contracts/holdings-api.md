# Contract: Holdings API

The REST surface introduced by this feature. Defined here as the authoritative contract; the
shared TypeScript types in `libs/api-contract/src/lib/holdings.ts` (see
[data-model.md](../data-model.md)) are the implementation of this contract and MUST stay in sync
with it, per Principle II.

All monetary/quantity fields (`quantity`, `purchasePrice`, `weight`, `purity`) are transmitted as
**decimal strings** (e.g. `"1.5"`), never JSON numbers, so precision is never lost to JSON's
floating-point number representation before reaching the `Decimal` type at either tier
(constitution's Money/decimal handling clause).

## `GET /holdings`

**Purpose**: Lists every holding lot, satisfying FR-010 (User Story 2). No filtering/pagination
parameters in this version — the client fetches the full list and renders it client-side (see
research.md #3 on scale assumptions).

**Request**: No parameters, no body.

**Response — 200 OK**:

```json
[
  {
    "id": "b3d1c2e4-...",
    "assetType": "ETF",
    "isin": "IE00B4L5Y983",
    "name": "iShares Core MSCI World",
    "quantity": "12.5",
    "purchasePrice": "78.42",
    "purchaseDate": "2026-03-01",
    "weight": null,
    "weightUnit": null,
    "purity": null,
    "createdAt": "2026-08-28T09:00:00.000Z",
    "updatedAt": "2026-08-28T09:00:00.000Z"
  }
]
```

An empty portfolio returns `200 OK` with `[]` (not a 404) — the frontend renders the empty state
(FR-011) from an empty array, distinct from a loading/error state.

## `POST /holdings`

**Purpose**: Creates a new holding lot (FR-001–FR-009, User Story 1). Every call creates an
independent row — there is no merge-by-asset behavior (FR-009).

**Request body** (`CreateHoldingRequest`) — shape depends on `assetType`; fields not applicable to
the chosen type MUST be omitted (a well-behaved client) and MUST be ignored/rejected if present (a
defensive server, per FR-006/Edge Cases):

```json
// ETF or SHARE
{
  "assetType": "ETF",
  "isin": "IE00B4L5Y983",
  "name": "iShares Core MSCI World",
  "quantity": "12.5",
  "purchasePrice": "78.42",
  "purchaseDate": "2026-03-01" // optional — omit entirely, not ""
}
```

```json
// GOLD
{
  "assetType": "GOLD",
  "weight": "1",
  "weightUnit": "TROY_OUNCE",
  "purity": "999.9",
  "quantity": "1",
  "purchasePrice": "1950.00"
}
```

```json
// BITCOIN
{
  "assetType": "BITCOIN",
  "quantity": "0.25",
  "purchasePrice": "42000.00"
}
```

**Response — 201 Created**: The full `HoldingResponse` (same shape as a `GET /holdings` list
item), including the server-generated `id`, `createdAt`, `updatedAt`.

**Response — 400 Bad Request** (validation failure — FR-007, FR-008, SC-002): structured body
identifying every failing field, not just the first:

```json
{
  "error": "VALIDATION_FAILED",
  "message": "One or more fields are invalid.",
  "fieldErrors": [
    { "field": "quantity", "message": "Quantity must be a positive number." },
    { "field": "purchaseDate", "message": "Purchase date cannot be in the future." }
  ]
}
```

**Contract test**: An integration test in `apps/backend/src/tests/holdings.e2e-spec.ts` issues a
real HTTP `POST` (via `supertest`) for each asset type with valid data and asserts the `201`
response shape, and for each Edge Case (negative quantity, future date, malformed ISIN, missing
Gold purity, extraneous Bitcoin fields) and asserts the exact `400` shape, per Principle IV.

## `PUT /holdings/:id`

**Purpose**: Edits an existing holding's fields in place (FR-012, User Story 3). `assetType` is
immutable — it is not accepted in the request body; the field set accepted is the same as
`POST /holdings` minus `assetType`, scoped to the holding's own existing type (FR-006).

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
value round-trips on a subsequent `GET`, and asserts other holdings are untouched (FR-012's "without
altering any previously saved holding").

## `DELETE /holdings/:id`

**Purpose**: Permanently removes a holding after client-side confirmation (FR-014, User Story 4).
Hard delete — no soft-delete/undo (spec.md Assumptions).

**Request**: No body.

**Response — 204 No Content**: Deletion succeeded.

**Response — 404 Not Found**: Same shape as `PUT`'s 404 — covers the "already deleted in another
tab" Edge Case. The frontend treats this as a successful outcome from the user's perspective (the
holding is gone either way) and refreshes the list rather than surfacing an error (research.md
#5).

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
