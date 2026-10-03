# Contract: Retirement REST API

All routes require a signed-in session (global `AuthGuard`) and `@RequiresDomain('retirement')`
(admins pass, members need `retirement` in `domainScopes`). `RetirementAvailableGuard` then answers
`503 RETIREMENT_UNAVAILABLE` on every route while `RETIREMENT_ENCRYPTION_KEY` is missing, invalid or
does not match the stored data. Every route reads and writes **only the caller's own data**; another
owner's id behaves like a missing id. Request bodies are validated by the strict whitelist in
`@vaultfolio/retirement`; types live in `@vaultfolio/api-contract` (`retirement.ts`). Logs contain
record id, pillar, type, parser id/version and outcome — never figures or identifiers.

## Error body

Same shape as the other domains (`ErrorResponseDto`): `{ error, message, details? }`. Validation
details name the field only: `details: [{ field, message: <CODE> }]`.

| Status | `error`                        | When                                                                      |
| ------ | ------------------------------ | ------------------------------------------------------------------------- |
| 400    | `RETIREMENT_VALIDATION`        | missing/invalid value (`details[].field`)                                 |
| 400    | `RETIREMENT_UNKNOWN_FIELD`     | field outside the whitelist or not applicable to the type                 |
| 400    | `RETIREMENT_CHECK_FAILED`      | imported figures fail a plausibility check (`details[].field` = check id) |
| 403    | `FORBIDDEN`                    | domain not entitled                                                       |
| 404    | `RETIREMENT_RECORD_NOT_FOUND`  | unknown id or id of another owner                                         |
| 409    | `RETIREMENT_IMPORTED_READONLY` | `PUT` on an `IMPORTED` record                                             |
| 409    | `RETIREMENT_NOT_IMPORTED`      | `PATCH …/supplement` on a `MANUAL` record                                 |
| 409    | `RETIREMENT_STATUTORY_EXISTS`  | second statutory record without `replaces`                                |
| 503    | `RETIREMENT_UNAVAILABLE`       | key missing/invalid                                                       |

## Routes

### `GET /retirement/summary` → `RetirementSummary`

Derived overview (see data-model.md "Derived"). Empty owner → zeros, `pensionStart: null`, empty
pillars.

### `GET /retirement/records?pillar=STATUTORY|OCCUPATIONAL|PRIVATE` → `RetirementRecord[]`

Full records incl. figures, supplement and identifier (the owner's own data), newest statement first.
`pillar` optional.

### `GET /retirement/records/:id` → `RetirementRecord`

### `POST /retirement/records` → `201 RetirementRecord`

Creates a record. Body (discriminated by `contractType`):

```text
{
  contractType, origin: 'MANUAL' | 'IMPORTED',
  status, providerLabel?, statementDate, payoutStart?,
  identifier?,
  figures: { … per type … },
  supplement?: { … }                       // IMPORTED only
  import?: { parserId, parserVersion, ocrRead: boolean }   // required iff origin = IMPORTED
  replaces?: <record id>                   // IMPORTED only: same pillar+type; old row deleted in the same transaction
}
```

- `MANUAL` + `import`/`supplement`/`replaces` → 400 `RETIREMENT_UNKNOWN_FIELD`.
- Second `STATUTORY` record without `replaces` → 409 `RETIREMENT_STATUTORY_EXISTS`.
- A `MANUAL` statutory record may be replaced by an `IMPORTED` one via `replaces` (and the reverse is
  delete + create).

### `PUT /retirement/records/:id` → `RetirementRecord`

Replaces a **manual** record (same body as POST without `origin`/`import`/`replaces`). Imported →
409 `RETIREMENT_IMPORTED_READONLY`.

### `PATCH /retirement/records/:id/supplement` → `RetirementRecord`

Body: `{ contributionMonthly?, employerContributionMonthly?, subsidiesYearly?, expectedMonthly?,
expectedScenario?, status? }` — only for `IMPORTED` records; on a `MANUAL` record → 409
`RETIREMENT_NOT_IMPORTED` (manual records use `PUT`). Unknown or inapplicable field → 400. Figures
from the document cannot be changed here.

### `DELETE /retirement/records/:id` → `204`

### `DELETE /retirement` → `204`

Deletes all of the caller's retirement data (spec FR-015); the account stays.

## Not in this API

- No file upload, no document or text transmission (spec FR-002c).
- No admin or cross-user route (constitution "Owner-only access").
- No search by identifier.

## OpenAPI

DTO classes in `apps/backend/src/openapi/dto/retirement.ts`; the OpenAPI completeness e2e spec and the
spec-version drift check must pass (new tag `retirement`).
