# Contract: Earnings REST API

All routes require a signed-in session (global `AuthGuard`) and `@RequiresDomain('earnings')`
(`DomainGuard`: admins pass, members need `earnings` in `domainScopes`). Every route reads and
writes **only the caller's own data** (`owner_id = session user`). Error bodies follow the existing
structured format (`error`, `message`, `correlationId`, optional `details`) from
`libs/observability`. Amounts are canonical decimal strings. Types live in
`libs/api-contract/src/lib/earnings.ts`; OpenAPI DTOs in `apps/backend/src/openapi/dto/earnings.ts`
(covered by the existing OpenAPI drift check); Bruno requests in `api/bruno/earnings/`.

**Common errors on every route**

| Status | `error`                | When                                                                          |
| ------ | ---------------------- | ----------------------------------------------------------------------------- |
| 401    | `unauthorized`         | no/expired session                                                            |
| 403    | `forbidden`            | domain not entitled                                                           |
| 503    | `EARNINGS_UNAVAILABLE` | encryption key missing/invalid or a ciphertext fails to authenticate (FR-044) |

## Import

### `POST /earnings/imports/preview`

Dry run. Validates and classifies; writes nothing. Body limit 5 MB (research R7).

Request `EarningsImportBatch`:

```jsonc
{
  "files": [
    {
      "clientFileId": "f1", // browser-local id, echoed back
      "fileName": "2026_09_Entgeltnachweis.pdf",
      "sourceType": "PAYSLIP_PDF", // PAYSLIP_PDF | CERTIFICATE_PDF | EXPORT_JSON
      "fileSha256": "9f2c…", // 64 hex chars
      "parserId": "sap-entgeltnachweis",
      "parserVersion": "1.0.0",
      "records": [
        {
          "employer": "Brightline Software GmbH",
          "period": "2026-09",
          "issued": "2026-09",
          "kind": "REGULAR",
          "seq": 1,
          "amounts": {/* PayRecordAmounts without `checks` — see data-model.md */},
        },
      ],
      "certificates": [
        {
          "employer": "Brightline Software GmbH",
          "year": 2025,
          "amounts": {/* CertificateAmounts */},
        },
      ],
    },
  ],
}
```

Response `200 EarningsImportPreview`:

```jsonc
{
  "files": [
    {
      "clientFileId": "f1",
      "status": "NEW", // NEW | REPLACES | DUPLICATE | REJECTED
      "employers": ["Brightline Software GmbH"],
      "periods": ["2026-07", "2026-09"],
      "years": [],
      "recordCount": 2,
      "includesCorrection": true,
      "replaces": [
        {
          "period": "2026-08",
          "kind": "REGULAR",
          "seq": 1,
          "importedAt": "2026-09-02T…",
          "fileName": "…",
        },
      ],
      "duplicateOf": null, // { importId, importedAt, fileName } when DUPLICATE
      "conflictsWith": null, // clientFileId of another file in this batch with the same identity
      "rejection": null, // { code, params } when REJECTED, e.g.
      // { "code": "CHECK_FAILED", "params": { "check": "NET", "period": "2026-08", "difference": "12.40" } }
    },
  ],
}
```

Rejection codes: `CHECK_FAILED` (params `check`, `period`, `difference`), `EARNINGS_UNKNOWN_FIELD`
(params `path`), `INVALID_VALUE` (params `path`), `LIMIT_EXCEEDED`.
Whole-request `400 EARNINGS_UNKNOWN_FIELD` / `400 INVALID_BATCH` when the batch envelope itself is
malformed.

### `POST /earnings/imports`

Same request body. Re-validates everything (FR-013) and saves each `NEW`/`REPLACES` file in its own
transaction; `DUPLICATE` and `REJECTED` files are skipped. Response `201 EarningsImportResult`:

```jsonc
{ "files": [ { "clientFileId": "f1", "status": "SAVED", "importId": "…", "recordCount": 2 },
             { "clientFileId": "f5", "status": "SKIPPED_DUPLICATE" },
             { "clientFileId": "f6", "status": "REJECTED", "rejection": { "code": "CHECK_FAILED", "params": { … } } } ] }
```

### `GET /earnings/imports`

Import history (FR-021, FR-037). `200 EarningsImportSummary[]`:
`{ id, fileName, sourceType, parserId, parserVersion, importedAt, recordCount, certificateCount,
employers[], firstPeriod, lastPeriod, years[] }` — newest first.

### `DELETE /earnings/imports/:id`

Removes the import and exactly its remaining records/certificates; removes employers left without
data. `204`; `404 EARNINGS_IMPORT_NOT_FOUND` (also for another user's id — no existence leak).

### `DELETE /earnings`

Deletes all of the caller's earnings data (FR-038). `204`.

## Employers

### `GET /earnings/employers`

`200 [{ id, detectedName, displayName }]`.

### `PUT /earnings/employers/:id`

Body `{ "displayName": "Brightline Software" }` (1–120 chars, trimmed; empty → `null` = use
detected name). `200` employer; `404 EARNINGS_EMPLOYER_NOT_FOUND`. No other field is editable
(FR-004, FR-020).

## Read models

Optional query `employer=<employerId>` filters every read model (FR-023); omitted = all employers.

### `GET /earnings/overview`

`200 EarningsOverview`:

```jsonc
{
  "hasData": true,
  "career": [ { "key": "ALL" | "<employerId>", "label": "…", "firstPeriod": "2012-09", "lastPeriod": "2026-09",
                "monthsEmployed": 168, "employerCount": 2,
                "totals": { "gross": "…", "net": "…", "taxes": "…", "social": "…", "bonus": "…" },
                "perMonth": { "gross": "…", … }, "netRatio": "0.6160" } ],
  "latestYear": { "year": 2026, "months": 9, "comparedMonths": [1, 9],
                  "current": { "gross": "…", "net": "…", "taxes": "…", "social": "…", "bonus": "…", "netRatio": "…" },
                  "previous": { … } },
  "yearly":  [ { "year": 2012, "monthsEmployed": 4, "gross": "…", "regular": "…", "bonus": "…", "net": "…",
                 "taxes": "…", "social": "…", "taxRatio": "…", "socialRatio": "…" } ],
  "monthly": [ { "period": "2012-09", "employerId": "…", "gross": "…", "regular": "…", "bonus": "…",
                 "net": "…", "taxes": "…", "social": "…", "payout": "…", "hasCorrection": false } ],
  "employerChanges": ["2017-01"],
  "dataCheckIssues": 1
}
```

Ratios are decimal strings with 4 decimal places (`"0.6160"`). `hasData: false` → empty state.

### `GET /earnings/records?period=YYYY-MM`

Month detail (FR-029). `200 EarningsRecordDetail[]` ordered by `seq`:
`{ id, employerId, employerLabel, period, issued, kind, seq, amounts (PayRecordAmounts incl.
checks), import: { id, fileName } }`. Without `period`: all records (used by the 029 export).

### `GET /earnings/tables`

`200 { monthGrid: { years: number[], metrics: { gross: {"2019-01": "…"}, regular: …, bonus: …,
net: …, taxes: …, social: …, payout: … }, bonusPeriods: string[], missingPeriods: string[] },
taxesPerYear: [ { year, employers[], monthsEmployed, gross, bonus, taxGross, wageTax, soli,
churchTax, health, care, pension, unemployment, taxRatio, socialRatio } ],
certificates: [ { id, year, employerId, employerLabel, amounts (CertificateAmounts), fileName } ] }`.

### `GET /earnings/data-check`

`200 [ { year, employerId, employerLabel,
ytd: { status: "MATCH" | "DIFFERS" | "NOT_AVAILABLE", compared: 8, differing: ["wageTax", …] },
certificate: { status: "MATCH" | "DIFFERS" | "NOT_AVAILABLE" | "NOT_COMPARABLE", compared, differing },
completeness: { status: "COMPLETE" | "MISSING" | "NO_PAYSLIPS", missingPeriods: ["2019-03"] },
lateCorrections: [ { period, issued } ] } ]`.

A year without any regular record (e.g. only a certificate) has `completeness.status:
"NO_PAYSLIPS"` (empty `missingPeriods`) and, if a certificate exists, `certificate.status:
"NOT_COMPARABLE"`; neither counts towards `dataCheckIssues`.

Only field _names_ of differing values are returned in `differing`; the UI shows amounts from the
already-returned yearly data if needed.
