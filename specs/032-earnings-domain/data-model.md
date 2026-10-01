# Data Model: Earnings Domain

Storage: SQLite (`DatabaseService`), four new tables created with `CREATE TABLE IF NOT EXISTS` in
`initializeSchema()` (new tables need no migration step). All monetary values live only inside the
encrypted `amounts_enc` payload (research R5). Every table carries `owner_id`, and every query
filters by it. Money in the application layer is always a canonical decimal string (`"1234.56"`,
`"-45.00"`), handled with `decimal.js`.

## Tables

### `earnings_imports`

One accepted file (FR-021).

| Column           | Type | Notes                                                                              |
| ---------------- | ---- | ---------------------------------------------------------------------------------- |
| `id`             | TEXT | PK, UUID                                                                           |
| `owner_id`       | TEXT | NOT NULL                                                                           |
| `file_name`      | TEXT | NOT NULL, original file name as selected (display only)                            |
| `source_type`    | TEXT | NOT NULL, CHECK IN (`PAYSLIP_PDF`, `CERTIFICATE_PDF`, `EXPORT_JSON`)               |
| `file_sha256`    | TEXT | NOT NULL, lowercase hex (64 chars), computed in the browser                        |
| `parser_id`      | TEXT | NOT NULL, e.g. `sap-entgeltnachweis`, `lohnsteuerbescheinigung`, `earnings-export` |
| `parser_version` | TEXT | NOT NULL, e.g. `1.0.0`                                                             |
| `imported_at`    | TEXT | NOT NULL, ISO timestamp default now                                                |

Indexes: `UNIQUE (owner_id, file_sha256)` (duplicate detection, FR-015); `(owner_id)`.
Record count and covered periods are derived (`COUNT`/`MIN`/`MAX` over records), so they stay
correct after a later import replaces some of this import's records. An import whose records
have all been replaced stays in the history showing "0 records (replaced)".

### `earnings_records`

One payslip section for one employer and period (Pay Record).

| Column        | Type    | Notes                                                                |
| ------------- | ------- | -------------------------------------------------------------------- |
| `id`          | TEXT    | PK, UUID                                                             |
| `owner_id`    | TEXT    | NOT NULL                                                             |
| `import_id`   | TEXT    | NOT NULL → `earnings_imports.id` (explicit cascade in repository)    |
| `employer_id` | TEXT    | NOT NULL → `earnings_employers.id`                                   |
| `period`      | TEXT    | NOT NULL, `YYYY-MM` — month the values belong to (FR-018)            |
| `issued`      | TEXT    | NOT NULL, `YYYY-MM` — month of the payslip containing the section    |
| `kind`        | TEXT    | NOT NULL, CHECK IN (`REGULAR`, `CORRECTION`, `PAYOUT_ONLY`)          |
| `seq`         | INTEGER | NOT NULL, ≥ 1 — order of sections for the same period                |
| `amounts_enc` | TEXT    | NOT NULL, `v1:<iv>:<tag>:<ciphertext>` of `PayRecordAmounts` (below) |
| `key_version` | INTEGER | NOT NULL DEFAULT 1                                                   |
| `created_at`  | TEXT    | NOT NULL                                                             |

Identity (FR-016): `UNIQUE (owner_id, employer_id, period, kind, seq)`. Importing a record with an
existing identity deletes the old row and inserts the new one inside the same transaction.
Indexes: `(owner_id, period)`, `(import_id)`.

**`PayRecordAmounts`** (encrypted JSON; all values decimal strings; deductions positive from the
employee's view, corrections may be negative):

| Key                                         | Meaning                                                                                                                                                |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `gross`                                     | Total gross (EBV Gesamtbrutto)                                                                                                                         |
| `taxGross`                                  | Tax gross (Steuerbrutto)                                                                                                                               |
| `svGrossKv`, `svGrossRv`                    | Social-insurance gross bases (KV/PV, RV/AV)                                                                                                            |
| `wageTax`, `soli`, `churchTax`              | Taxes                                                                                                                                                  |
| `health`, `care`, `pension`, `unemployment` | Employee share; voluntary KV/PV = contribution − subsidy (FR-019)                                                                                      |
| `net`                                       | Statutory net                                                                                                                                          |
| `other`                                     | Other deductions/additions (`payout − net` of this section)                                                                                            |
| `payout`                                    | Payout; only on the section of the payslip's own month, else `null`                                                                                    |
| `oneOff`                                    | Object with the one-off portion of `gross`, `taxGross`, `wageTax`, `soli`, `churchTax`, `health`, `care`, `pension`, `unemployment` (missing keys = 0) |
| `employerSubsidy`                           | `{ health, care }` — employer subsidy for voluntary insurance, or `null`                                                                               |
| `ytd`                                       | Printed year-to-date totals (regular record of the year's payslips only), keys as above, or `null`                                                     |
| `checks`                                    | `[{ code, passed, difference }]` — per-record check results                                                                                            |

AAD for encryption: `earnings_records|<id>|<owner_id>`.

### `earnings_certificates`

Wage-tax certificate per employer and year.

| Column        | Type    | Notes                                    |
| ------------- | ------- | ---------------------------------------- |
| `id`          | TEXT    | PK                                       |
| `owner_id`    | TEXT    | NOT NULL                                 |
| `import_id`   | TEXT    | NOT NULL                                 |
| `employer_id` | TEXT    | NOT NULL                                 |
| `year`        | INTEGER | NOT NULL                                 |
| `amounts_enc` | TEXT    | NOT NULL, encrypted `CertificateAmounts` |
| `key_version` | INTEGER | NOT NULL DEFAULT 1                       |
| `created_at`  | TEXT    | NOT NULL                                 |

Identity: `UNIQUE (owner_id, employer_id, year)` (re-import replaces).

**`CertificateAmounts`** (official form lines): `grossWage` (line 3), `wageTax` (4), `soli` (5),
`churchTax` (6), `multiYearComp` + taxes on it (lines 10–13), `employerSubsidyHealth` (24a),
`employerSubsidyCare` (24c), `health` (25), `care` (26), `pensionEmployee` (23a),
`unemployment` (27), `pensionEmployer` (22a). All decimal strings, missing lines `"0.00"`.

### `earnings_employers`

Employer per owner (FR-020).

| Column          | Type | Notes                                                   |
| --------------- | ---- | ------------------------------------------------------- |
| `id`            | TEXT | PK                                                      |
| `owner_id`      | TEXT | NOT NULL                                                |
| `detected_name` | TEXT | NOT NULL, normalized name from the document (match key) |
| `display_name`  | TEXT | NULL — user-chosen label; falls back to `detected_name` |
| `created_at`    | TEXT | NOT NULL                                                |

Identity: `UNIQUE (owner_id, detected_name)`. Created on first import that mentions it. Rows with
no remaining records or certificates are removed when an import is deleted.

## Validation rules (server, `libs/earnings` + backend DTO checks)

- Whitelist: any unknown key at any level of the import body → `400 EARNINGS_UNKNOWN_FIELD`
  (constitution Sensitive Personal Data; FR-009).
- `period`/`issued` match `^\d{4}-(0[1-9]|1[0-2])$`; `issued ≥ period` for corrections.
- `kind = CORRECTION ⇒ issued > period`; `REGULAR ⇒ issued = period`.
- All amount strings match `^-?\d{1,9}\.\d{2}$`.
- Per-record check (R4) must pass; per-payslip payout check must pass; any failure rejects the
  whole file (FR-012).
- `file_sha256` matches `^[0-9a-f]{64}$`; `fileName` ≤ 255 chars, no path separators.
- Batch ≤ 400 files, file ≤ 2,000 records (R7).

## Derived read models (computed by `libs/earnings`, never stored)

- **Monthly series**: per `period`, sum of all records (regular + corrections + payout-only).
  `regular = gross − oneOff.gross`, `bonus = oneOff.gross`, `taxes = wageTax + soli + churchTax`,
  `social = health + care + pension + unemployment`.
- **Months employed**: distinct periods with a `REGULAR` record (payout-only months excluded).
- **Yearly series**: sum of monthly by calendar year of `period`; averages divide by months
  employed.
- **Career**: whole-career (only when > 1 employer) and per-employer totals with first/last period.
- **Latest-year KPIs**: latest year with data (months `1..n`) vs. same months `1..n` of the previous
  year (design decision); net ratio delta in percentage points.
- **Data check** per employer and year: (a) sum of records vs. `ytd` of the year's last regular
  record (highest `issued`, `period`, `seq`); (b) sum vs. certificate if present, adding lines
  10–13; (c) completeness: no missing regular months between first and last regular month of the
  year. Corrections with `issued` after that last record are excluded from (a) and (b) and listed
  as `lateCorrections`. A year without any regular record is `NO_PAYSLIPS` and its certificate
  `NOT_COMPARABLE` (informational, not an issue).

## State transitions

```
file selected ─► parsed in browser ─┬─► rejected (unsupported / image-only / password / check failed) ─► not sent
                                     └─► candidate ─► preview (server) ─┬─► new / replaces ─► commit ─► saved (import + records)
                                                                         ├─► duplicate ─► skipped
                                                                         └─► rejected (server check / whitelist) ─► not saved
saved import ─► delete import ─► its records/certificates removed; orphaned employers removed
all data ─► delete all ─► all four tables emptied for owner
user purged (retention expiry / deletion) ─► all four tables emptied for owner
```
