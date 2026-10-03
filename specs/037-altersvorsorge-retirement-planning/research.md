# Research: Altersvorsorge (Retirement Planning)

All items below resolve what the plan needs; none of them stayed open.

## R1 — Where the domain logic lives

**Decision**: New framework-independent lib `@vaultfolio/retirement` (`libs/retirement`, tag
`scope:shared`, like `@vaultfolio/earnings`). It owns the model, whitelist validation, plausibility
checks, parsers, summary aggregation and the static resource list.

**Rationale**: Principle I; the browser (parsers, review pre-checks) and the backend (validation,
summary) must run identical logic. `scope:shared` lets both tiers depend on it.

**Alternatives**: Putting logic in the backend module (browser could not parse/pre-check; violates
Principle I); extending `@vaultfolio/earnings` (unrelated domain, grows a tangled lib).

## R2 — Reusing the PDF reading stack across domains

**Decision**: Extract two small shared libs, behaviour-neutral, done as the first tasks:
`@vaultfolio/document-text` (types `PdfDocumentText`/`PdfPageText`/`PdfLine`/`PdfWord`, German
amount/date token helpers, OCR digit normalisation — pure TS) and `@vaultfolio/frontend-document-reader`
(PDF.js text extractor, SHA-256, blob reading, `TextRecogniser` port + tesseract adapter + layout
conversion, injection token, consent/progress UI building block). `@vaultfolio/earnings` re-exports the
moved symbols so its own consumers keep compiling; the Earnings frontend switches its imports.

**Rationale**: `scope:frontend-domain` may only depend on `scope:shared`, so Retirement cannot import
the Earnings frontend lib; the OCR assets are already wired in `apps/frontend/project.json`.

**Alternatives**: Importing from `frontend-domain-earnings` (boundary violation); copying (duplicated
code and drift); making Earnings export these from `@vaultfolio/earnings` only (the pure types would
work, but the browser adapter cannot live in a pure lib).

## R3 — Encryption and key

**Decision**: Dedicated operator key `RETIREMENT_ENCRYPTION_KEY` (Base64 of 32 bytes). A
`RetirementCryptoService` mirrors `EarningsCryptoService` (AES-256-GCM, fresh 12-byte IV, AAD
`retirement_records|<id>|<owner_id>`, format `v1:iv:tag:ciphertext`, boot-time self-check against one
stored row, runtime auth failure flips to unavailable). The AEAD primitive is extracted to
`apps/backend/src/shared/field-crypto.ts` and used by both services; Earnings behaviour and tests stay
unchanged. A `RetirementAvailableGuard` answers `503 RETIREMENT_UNAVAILABLE` on every route while the
key is missing or invalid; other domains keep working.

**Rationale**: Constitution "Encryption at rest" and "fails closed"; independent key lifecycle per
sensitive domain.

**Alternatives**: Reusing `EARNINGS_ENCRYPTION_KEY` (couples availability and rotation); no
encryption for identifiers (rejected: constitution 3.9.0 keeps them under the encrypted rules).

## R4 — What is encrypted and what is plain

**Decision**: One `payload_enc` per row holds all monetary figures **and** the insurance/contract
number. Plain columns: `pillar`, `contract_type`, `origin`, `status`, `provider_label`,
`statement_date`, `payout_start`, `parser_id`/`parser_version`, `ocr_read`, timestamps.

**Rationale**: Constitution: "non-monetary lookup fields MAY remain in plain form"; dates and labels
are needed for listing/sorting and are not amounts. Identifiers are encrypted because the 3.9.0
exception only relaxes the storage ban, not the protection. Duplicate detection by contract number
decrypts the owner's rows of the same pillar (≤ a handful), so no searchable hash of the identifier
is stored.

**Alternatives**: Storing an HMAC of the number for lookup (extra secret, no need at this scale);
encrypting the dates too (breaks sorting without benefit; dates alone are not sensitive).

## R5 — Read-only imports with a user-supplemented part

**Decision**: The payload separates `figures` (from the document, immutable for `origin = IMPORTED`)
from `supplement` (figures the statement does not print: monthly contribution, employer share,
annual subsidies, expected pension for capital-based contracts, chosen expected-pension scenario).
`PUT /retirement/records/:id` only works for `MANUAL` records; for `IMPORTED` it answers
`409 RETIREMENT_IMPORTED_READONLY`. `PATCH /retirement/records/:id/supplement` edits only the
supplement of an imported record. Replacing an imported record happens through
`POST /retirement/records` with `replaces: <id>` (same pillar/type; the old row is deleted in the
same transaction).

**Rationale**: Matches spec FR-002a (imported figures not editable by the user, except what the
statement does not print), the mockup footer ("nur ergänzte Felder bearbeitbar") and the Riester
reality (the statement has no current monthly contribution).

**Alternatives**: Fully immutable imports (user cannot add the contribution later); allowing edits
and flipping origin to manual (breaks the guarantee that "imported" means "as printed").

## R6 — Parsers and plausibility checks

**Decision**: Deterministic, label-based parsers over `PdfDocumentText` with a registry that detects
a layout by marker labels and reports parser id + version; no match → rejected as a whole with
manual entry offered. Three parsers at launch, each paired with arithmetic/consistency checks that
the server re-runs from the figures:

1. **DRV Renteninformation** (sample is a scan, so OCR path): figures per spec FR-002. Checks:
   `earningsPoints × currentPensionValue ≈ accruedMonthly` (±0.01 per rounding), `accrued ≤
projected ≤ at1pct ≤ at2pct`, `fullDisability ≥ accrued`, retirement date after letter date.
2. **Private/Riester annual statement** (§ 155 VVG / AltZertG style; sample has a text layer):
   guaranteed pension/capital at payout start, scenarios at 0/3/6/9 %, surrender and death benefit,
   fund value, contributions paid, subsidies paid, guarantee period, statement date. Checks:
   scenarios strictly non-decreasing; guaranteed ≤ 0 % scenario; main contributions + extra
   payments = total paid.
3. **Employer capital-account statement** (e.g. contribution-oriented account): opening balance,
   guaranteed interest rate and credit, contribution, closing balance, hypothetical final bonus,
   employer reference. Checks: `opening + interest + contribution = closing`; `interest ≈ opening ×
rate`.

**Rationale**: Constitution "deterministic, reproducible, no external service". The checks are the
defence against OCR misreads (spike in 034: decimal separators in small print get lost) and make
"inconsistent → reject whole" (spec edge case) testable. Parser coverage is intentionally small:
private statements follow legal templates so a label-based reader should generalise; employer
statements vary and fall back to manual.

**Alternatives**: A generic "find all euro amounts" extractor (non-deterministic mapping, unsafe);
LLM/cloud extraction (forbidden); user-corrected figures in the preview as in Earnings (not in
scope: Retirement import is review-only, a wrong read is rejected or entered manually).

## R7 — Import flow and consent

**Decision**: Reuse the Earnings pattern with the shared reader: extract text with PDF.js; if the PDF
has no text layer, show the per-file consent card (design.md "Scan consent"), run on-device OCR,
tag text `origin: RECOGNISED`; parse; show the review table; send only the whitelisted figures
(+ identifier the user confirms, + supplement) and `parserId`/`parserVersion`/`ocrRead`. The original
file and extracted text are never transmitted or stored. Name, address, tax id and bank details are
not part of any parser output and the server rejects unknown fields (400).

**Rationale**: Constitution Sensitive Personal Data (on-device interpretation, per-file consent,
data minimisation). The real DRV sample is a scan, so the OCR path is the primary path for the
statutory pillar.

**Alternatives**: Server-side parsing (forbidden); parser requests for unknown layouts as in
Earnings (explicitly out of scope; the constitution limits that exception to Earnings).

## R8 — Summary aggregation rules

**Decision** (computed in `@vaultfolio/retirement`, run server-side for the API and reused for
export/tile):

- **Guaranteed monthly pension** = Σ `guaranteedMonthly` of occupational + private records.
- **Expected monthly pension** = statutory projected regular pension + Σ per contract
  `max(expectedMonthly, guaranteedMonthly)` (a contract without an expected figure counts at its
  guarantee). Capital-only records contribute nothing.
- **Monthly savings** = Σ (`contributionMonthly` + `employerContributionMonthly`) of occupational +
  private records in status ACTIVE.
- **Pension start** = statutory regular retirement date; per record, a start earlier/later than it is
  flagged (`earlier`/`later`). Without a statutory record the earliest `payout_start` is shown with a
  hint.
- **Difference** = expected − guaranteed.
- **Outdated** = `statement_date` more than 12 months before today (injectable clock for tests).
  **Incomplete** = a figure needed for the sums is missing for that record.
- Capital payouts and capital accounts are summed separately and never added to monthly figures.
- Amounts are gross nominal; no tax, inflation or pension-gap calculation.

**Rationale**: Reproduces the mockup's numbers exactly (guaranteed 403 €, expected 2.860 €, savings
335 €) and answers "the statutory pension is a projection, not a guarantee" (confirmed in review).

**Alternatives**: Counting the statutory pension as guaranteed (the Renteninformation itself calls it a
projection); estimating a pension from a capital balance with an annuity factor (invented number).

## R9 — Expected-pension scenario for imported private statements

**Decision**: A private statement lists pensions at 0/3/6/9 %. The review step preselects the **3 %**
scenario as `expectedMonthly` (the typical "mean" variant) and lets the user pick another; the choice is
stored in the supplement together with all four printed scenario values in `figures`.

**Rationale**: The overview needs one expected value per contract; making the choice explicit keeps it
honest (it is a projection, labelled "Prognose").

**Alternatives**: Always 0 % (understates), always 6 % (overstates), average of the four (meaningless).

## R10 — API shape and ownership

**Decision**: Single resource `/retirement/records` with typed, discriminated payloads, plus
`GET /retirement/summary`, `DELETE /retirement` (all data), `PATCH …/supplement`. Every query filters
by `owner_id` in SQL; foreign ids behave like missing ids (404). `@RequiresDomain('retirement')` +
`RetirementAvailableGuard`. Request bodies are validated by the lib's strict whitelist (not a DTO pipe),
like Earnings. Body limit stays at the default (no files are sent).

**Rationale**: Constitution Principle II and Sensitive Personal Data ("reject unknown fields",
"owner-only"). A single resource keeps one table and one repository.

**Alternatives**: Separate endpoints per pillar (three near-identical controllers).

## R11 — Frontend structure, dashboard and export

**Decision**: `RetirementAreaComponent` replaces the placeholder with tabs as routes (`''`,
`statutory`, `occupational`, `private`, `info`) plus `import` and `new/:type` / `:id/edit` screens, an
available guard like Earnings. Dashboard: add an entry to `DASHBOARD_WIDGET_CONTRIBUTIONS`
(`domainId: 'retirement'`, `titleKey: 'dashboard.retirement'`). Export: replace the empty
`RETIREMENT_EXPORT_DEFINITION` with a factory definition (injects the service) that exports the
records table (pillar, type, provider, number, guaranteed, expected, contribution, payout start,
statement date, origin) in all four formats (spec FR-019), registered lazily like Earnings. i18n in
`retirement.de.ts`/`retirement.en.ts` with a key-parity spec like Earnings'. New interactive elements
get `data-testid`s per `docs/frontend/testid-conventions.md`.

**Rationale**: Follows the established domain-library, widget-registry and export-registry patterns;
no change to `DashboardComponent` or the export control itself.

**Alternatives**: Keeping the placeholder component and adding screens ad hoc (no routing for deep
links to tabs); a bespoke dashboard mechanism (violates the registry convention).

## R12 — Tests must not contain real documents

**Decision**: `libs/retirement/src/lib/testing` builds synthetic documents (text + layout) that
reproduce the three real layouts and invented, internally consistent figures; real PDFs stay in the
gitignored `tmp/` and are used only for local manual checks. A secretlint/commit check already
guards the repo.

**Rationale**: Constitution Principle IV ("real personal documents MUST NOT be committed as
fixtures; synthetic documents reproducing the real layout satisfy the real-format requirement").

**Alternatives**: Redacted real PDFs (still personal data and layout fingerprints of a person).

## R13 — Documentation and operations

**Decision**: Document `RETIREMENT_ENCRYPTION_KEY` in `.env.example`, both compose files, README
(EN/DE) incl. the "key missing → 503, other domains keep working" behaviour and the privacy
statements; add a user-guide section (EN/DE) for upload vs manual entry, read-only imports and the
supported statement types.

**Rationale**: Mirrors how Earnings' key is documented; the operator must know the key is mandatory
for the domain.
