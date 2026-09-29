# Contract: `earnings-export` JSON, version 1

Interchange file produced by the companion local tool (earnings-evolution, `make export`) and
accepted by the Earnings import (User Story 4, FR-007). It is the **only** JSON the import accepts.
Validation is strict: any key not listed here, at any level, rejects the file
(`EXPORT_UNKNOWN_FIELD`); an unknown `schema`/`version` rejects it (`EXPORT_UNSUPPORTED_VERSION`).

## Shape

```jsonc
{
  "schema": "earnings-export", // required, exact value
  "version": 1, // required, integer; only 1 is supported
  "generated": "2026-09-27T11:37:49", // required, ISO local date-time (informational)
  "records": [
    // required, may be empty
    {
      "employer": "Deutsche Bundesbank", // required, 1–200 chars (display name of the employer)
      "period": "2011-09", // required, YYYY-MM
      "issued": "2011-10", // required, YYYY-MM, >= period
      "kind": "regular", // required: regular | correction | payout_only
      "seq": 1, // required, integer >= 1
      "amounts": {
        // required; integer cents; missing key = 0
        "gross": 0,
        "tax_gross": 0,
        "sv_gross_kv": 0,
        "sv_gross_rv": 0,
        "wage_tax": 0,
        "soli": 0,
        "church_tax": 0,
        "health": 0,
        "care": 0,
        "pension": 0,
        "unemployment": 0,
        "net": 0,
        "other": 0,
        "payout": 0, // payout: null allowed (not the payslip's own month)
      },
      "one_off": {/* same keys as amounts (subset), integer cents */}, // optional
      "employer_share": { "health_subsidy": 0, "care_subsidy": 0 }, // optional
      "ytd": {/* same keys as amounts, integer cents */}, // optional, regular records only
    },
  ],
  "certificates": [
    // required, may be empty
    {
      "employer": "evosoft",
      "year": 2025,
      "amounts": {
        // integer cents, missing key = 0
        "gross_wage": 0,
        "wage_tax": 0,
        "soli": 0,
        "church_tax": 0,
        "multi_year_comp": 0,
        "multi_year_wage_tax": 0,
        "multi_year_soli": 0,
        "multi_year_church_tax": 0,
        "pension_employer": 0,
        "pension_employee": 0,
        "employer_subsidy_health": 0,
        "employer_subsidy_care": 0,
        "health": 0,
        "care": 0,
        "unemployment": 0,
      },
    },
  ],
}
```

## Deliberately excluded (data minimization)

Not part of v1 and therefore rejected if present: `source` file paths, `notes`, `items` (free-text
line-item labels), `checks`, `validation`, `bonuses` (VZE), `pensions` (BSAV), any document text,
and any personal identifier. VZE/BSAV may come in a later version together with iteration 2.

## Mapping to the import model

- Cents → decimal string exactly (`123456` → `"1234.56"`, `-2207` → `"-22.07"`).
- `kind` → `REGULAR` / `CORRECTION` / `PAYOUT_ONLY`; snake_case keys → camelCase keys of
  `PayRecordAmounts` / `CertificateAmounts` (data-model.md).
- Each record must pass the same per-record check as PDF imports; any failure rejects the whole
  file. The per-payslip payout check is applied per `(employer, issued)` group.
- The import is recorded with `sourceType: EXPORT_JSON`, `parserId: earnings-export`,
  `parserVersion: 1`.
- `one_off.sv_gross_kv` / `one_off.sv_gross_rv` are accepted (the companion tool writes them) but
  not stored — the import model has no one-off part of the social-insurance bases.

## Record identity and `seq`

A record's identity is `(employer, period, kind, seq)` (FR-016); re-importing the same identity
replaces the stored record. `seq` must therefore be unique per identity:

- `regular` and `payout_only` records use `seq: 1`.
- A `correction` uses `seq = 1 + months between period and issued` (a July correction issued with
  the September payslip → `seq: 3`). The PDF parser uses the same convention, so an export and the
  PDFs of the same payslips resolve to the same identities, and two corrections of one month issued
  by different payslips never collide. (earnings-evolution used a fixed `seq: 2` for corrections;
  the export must emit the convention above.)

## Versioning

MAJOR-only integer version (constitution Principle V: breaking changes → new version + documented
migration). Additive optional keys also require a new version, because v1 validation is closed.
