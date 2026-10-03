# Contract: `@vaultfolio/retirement` (framework-independent library)

`libs/retirement`, tag `scope:shared`, no Angular/NestJS/DOM imports (Principle I). Used by the
browser (parsers, review pre-checks, forms) and by the backend (validation, checks, summary).
Money is `decimal.js`-backed; the wire/storage form is a canonical decimal string.

## Model

```text
type Pillar = 'STATUTORY' | 'OCCUPATIONAL' | 'PRIVATE';
type ContractType = 'STATUTORY_PENSION' | 'DIRECT_INSURANCE' | 'PENSIONSKASSE' | 'DIREKTZUSAGE'
  | 'UNTERSTUETZUNGSKASSE' | 'PENSIONSFONDS' | 'CAPITAL_ACCOUNT'
  | 'RIESTER' | 'PRIVATE_PENSION_INSURANCE' | 'ALTERSVORSORGEDEPOT';
type Origin = 'IMPORTED' | 'MANUAL';
type Status = 'ACTIVE' | 'PAID_UP' | 'IN_PAYOUT';
pillarOf(type): Pillar
```

Types for records, figures and supplements are declared once in `@vaultfolio/api-contract`
(`retirement.ts`) and re-exported here (same pattern as `@vaultfolio/earnings`).

## Validation

```text
validateRecordInput(body: unknown, opts: { now: Date }): ValidationResult<RecordInput>
validateSupplement(type: ContractType, body: unknown): ValidationResult<Supplement>
```

- Strict whitelist per type; unknown/inapplicable field → issue `UNKNOWN_FIELD` with the field path.
- Returns canonicalised decimals; never throws for user input.
- Issue codes: `REQUIRED`, `INVALID_AMOUNT`, `INVALID_DATE`, `INVALID_VALUE`, `OUT_OF_RANGE`, `INVALID_IDENTIFIER`,
  `GUARANTEE_ABOVE_EXPECTED`, `UNKNOWN_FIELD`, `NOT_APPLICABLE`.

## Checks

```text
runChecks(type: ContractType, figures: Figures, dates: { statementDate; payoutStart? }): CheckResult[]
// CheckResult = { id: CheckId; ok: boolean }   — ids only, no figures (log/response safe)
```

Check ids as in data-model.md "Plausibility checks". Parsers call `runChecks` and reject on any
failure; the server calls it again for `IMPORTED` records.

## Parsers

```text
parseStatement(text: PdfDocumentText): ParseOutcome

type ParseOutcome =
  | { ok: true; parser: { id: string; version: string }; record: ParsedRecord }
  | { ok: false; error: 'UNRECOGNISED' | 'INCONSISTENT' | 'INCOMPLETE'; failedChecks?: CheckId[] };

ParsedRecord = {
  contractType, statementDate, payoutStart?, providerLabel?, identifier?,
  figures, defaults?: { expectedScenario?: '0'|'3'|'6'|'9' },
  missingSupplement: Array<'contributionMonthly' | 'employerContributionMonthly' | 'subsidiesYearly' | 'expectedMonthly'>
}
```

- `PARSERS` registry: each entry `{ id, version, detects(text): boolean, parse(text) }`; first match
  wins; none → `UNRECOGNISED`. Launch parsers: `drv-renteninformation`, `private-statement`,
  `capital-account-statement` (research R6).
- Deterministic and reproducible per input + parser version; label-based over `PdfLine.words`
  (column-aware where tables exist); input may be `origin: 'EXTRACTED' | 'RECOGNISED'` — recognised
  text goes through `@vaultfolio/document-text` OCR normalisation of number tokens first.
- Output never contains name, address, tax id or bank data: the parsers only read whitelisted labels;
  the identifier is the insurance/contract/reference number only.
- Parsers do not "heal" misread figures; inconsistent figures → `INCONSISTENT`.

## Summary

```text
summarize(records: StoredRecord[], now: Date): RetirementSummary
```

Rules as in research R8. Pure and deterministic given `now`; exact-decimal arithmetic; capital figures
never added to monthly sums.

## Resources

```text
RETIREMENT_RESOURCES: ReadonlyArray<{ id; titleKey; descriptionKey; sourceKey; url; categoryKey }>
```

Static list of the three external links of spec FR-012 (DRV, Finanzfluss, Finanztip); URLs are
constants checked by a unit test (https only, exact hosts). Text lives in i18n.

## Testing helpers (`testing/`)

`buildRecord(overrides)`, `syntheticDrvRenteninformation()`, `syntheticPrivateStatement()`,
`syntheticCapitalAccountStatement()` build `PdfDocumentText` reproducing the real layouts (labels,
column positions, number formats) with invented, internally consistent values; variants for a
misread figure, a missing label and a scanned (recognised) rendition. No real personal data.
