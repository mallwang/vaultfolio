# Research: Earnings Domain

Phase 0 decisions for [plan.md](plan.md). Each entry: **Decision**, **Rationale**, **Alternatives
considered**. Codebase facts cited here were verified against the repository on 2026-09-29.

## R1 — Where the shared earnings logic lives (Nx boundaries)

**Decision**: One new framework-free library, `libs/earnings` (`@vaultfolio/earnings`), tagged
**`scope:shared`**. It contains the normalized record model, money helpers, the per-record and
per-year checks, the document parsers (text → records), the companion-export (v1) reader, and the
aggregations (career, yearly, monthly, KPIs, data check). The frontend domain library runs the
parsers; the backend re-runs the checks and computes aggregations with the same code.

**Rationale**: `eslint.config.mjs` only lets `scope:frontend-domain` depend on `scope:shared`, and
`scope:backend` on `scope:shared` + `scope:domain`. Parsers and checks must run in the browser
(FR-008) _and_ on the server (FR-013), so a `scope:domain` library (like `libs/domain/holdings`)
would be unreachable from `libs/frontend/domain/earnings`. `libs/export` and `libs/account-fields`
already set the precedent for `scope:shared` libraries that hold feature logic used by both tiers.
One library (not separate parser/check/aggregation libs) keeps Principle V's simplicity: these
pieces share one model and have no independent consumers.

**Alternatives considered**: `libs/domain/earnings` (`scope:domain`) — blocked by module
boundaries for the browser parsers. Duplicating checks in frontend and backend — two sources of
truth for money rules (violates Principle I's intent). Changing the boundary rules — a
constitution-level Stack Decision change for no benefit.

## R2 — PDF text extraction in the browser

**Decision**: Add **`pdfjs-dist`** (Mozilla PDF.js, pinned exact version) as the single new
dependency, used only inside `libs/frontend/domain/earnings` behind a small adapter
(`pdf-text-extractor.ts`) that returns `PdfDocumentText` = pages → positioned text items → lines.
The PDF.js worker file is served from the frontend's own assets (no CDN), and the whole import
route is lazy-loaded so PDF.js never ships in the main bundle.

Line reconstruction: group `TextItem`s by baseline `y` (tolerance ≈ 2pt), sort by `x`, join with
single spaces where the gap exceeds a small threshold; keep each word's `x` so column-sensitive
parsers can use positions. `PasswordException` → `PASSWORD_PROTECTED`; a document whose pages
yield no text items → `IMAGE_ONLY` (scanned); other load errors → `UNREADABLE`.

**Rationale**: FR-008 requires parsing on the user's device; PDF.js is the de-facto standard,
Apache-2.0, maintained, works in all evergreen browsers, and exposes positioned text needed for
column layouts. The earnings-evolution parsers are line/label based (pdfplumber), so a
line-reconstruction layer gives parsers an equivalent input.

**Alternatives considered**: `pdf-parse`/`pdf2json` — Node-oriented, wrap old PDF.js versions.
Server-side parsing with the Python extractor — violates FR-008 and the constitution's Sensitive
Personal Data rules. WASM ports of pdfplumber/poppler — heavy, no clear benefit.

**Risk**: text ordering differs from pdfplumber. Mitigated by the parity script (R9) and by the
arithmetic checks, which reject any file the parser misreads (FR-012).

## R3 — Parser design and versioning

**Decision**: A parser is a pure object in `libs/earnings`:
`{ id, version, documentType, detect(doc) → boolean, parse(doc) → ParseOutcome }`, registered in
an ordered `PARSER_REGISTRY`: (1) `lohnsteuerbescheinigung` (official BMF form, line-number based,
works for every employer), (2) `sap-entgeltnachweis` (port of earnings-evolution's
`extractor/parsers/evosoft.py`: sections per month, corrections, `Y551`/`/552` handling, voluntary
KV/PV own-share rule, JAHRESSUMMEN → year-to-date). First match wins; none → `UNSUPPORTED_FORMAT`.
`parse` returns normalized records or a typed failure with an **error code + params** (no
language text — FR-046), and every successful record carries `parserId@version`. Employer name is
read from the document header and normalized (trim, collapse whitespace).

**Rationale**: Mirrors the proven `classify()` → `parse()` order of earnings-evolution. Versioning
makes stored records traceable to the parser that produced them (constitution Principle V
exception: import metadata instead of logged amounts). Codes instead of strings keep parsers
framework-free and translatable.

**Alternatives considered**: One generic "EBV" parser now — explicitly iteration 2 in the spec.
LLM-based extraction — prohibited by the constitution (Sensitive Personal Data: deterministic, no
external services).

## R4 — Money representation and checks

**Decision**: All amounts are canonical decimal strings (2 decimal places, `-` for negatives) in
every interface; arithmetic uses `decimal.js` (already a root dependency and used by
`libs/domain/holdings`). Per-record check: `gross − (wage_tax + soli + church_tax) − (health + care

- pension + unemployment) = net`with`|diff| ≤ 0.01`. Per-payslip check: `Σ(net + other)`over
its sections`= payout` (`≤ 0.01`). Parser-specific checks (e.g. SAP "Zahlnetto") may be added by
a parser. The companion export's integer cents are converted exactly (`cents / 100`via`Decimal`). Check results are stored as `{ code, passed, difference }`.

**Rationale**: Constitution Stack Decision (exact decimals end-to-end) and Principle III
(exact-value assertions). The 1-cent tolerance matches the reference app and the spec (FR-011).

**Alternatives considered**: integer cents throughout — cheaper, but diverges from the
constitution's canonical-decimal-string rule used everywhere else in Vaultfolio.

## R5 — Encryption at rest

**Decision**: **AES-256-GCM** via `node:crypto`, one ciphertext per row. The whole monetary
payload of a record (all amounts, one-off split, employer subsidy, year-to-date totals) or of a
certificate is serialized as JSON of decimal strings and encrypted into a single `amounts_enc`
column (format `v1:<iv b64>:<tag b64>:<ciphertext b64>`), with a fresh 12-byte random IV per write
and **AAD = `<table>|<row id>|<owner_id>`** so a ciphertext cannot be moved to another row or
user. Key: `EARNINGS_ENCRYPTION_KEY` (base64, exactly 32 bytes after decoding), documented in
`.env.example`, docker-compose files and README; a `key_version` column (initially `1`) prepares
for later rotation (constitution TODO). An `EarningsCryptoService` validates the key at boot; if
missing/invalid it marks the domain **unavailable** (it does not crash the app — other domains keep
working), and every earnings endpoint then responds `503 EARNINGS_UNAVAILABLE` (FR-044). A GCM
authentication failure on read is treated the same way (fail closed, never partial data).

**Rationale**: Meets FR-041 and the constitution's encryption-at-rest carve-out with the platform
crypto library (no dependency). Row-level payload encryption keeps the schema simple and the
number of crypto operations tiny (≈12 rows/year/user). Plain columns remain only for lookup
(owner, employer, period, kind, seq, year).

**Alternatives considered**: SQLCipher — whole-database change, native rebuild, affects all
domains, and the key would protect non-sensitive tables too. Per-column encryption — many more
ciphertexts, no benefit. Per-user keys derived from passwords — breaks password reset and
server-side checks (already rejected with the user).

## R6 — Import API shape (preview, then commit)

**Decision**: Two endpoints carrying the same normalized, whitelisted body
(`EarningsImportBatch`: files → `{ clientFileId, fileName, sourceType, fileSha256, parserId,
parserVersion, records[], certificates[] }`):

- `POST /earnings/imports/preview` — server validates the whitelist, re-runs all checks, and
  classifies each file as `new` / `replaces` / `duplicate` / `rejected` (with codes), including
  conflicts _within_ the batch (same identity twice → the later `issued` wins, the other file is
  flagged). Writes nothing.
- `POST /earnings/imports` — re-does the same validation (never trusts the preview) and saves every
  non-rejected, non-duplicate file in **one transaction per file**, returning the per-file outcome.

Files the browser already rejected (unsupported, scanned, check failed) are not sent at all; the
browser shows them from its local result. The fingerprint is SHA-256 of the file bytes, computed
in the browser with `crypto.subtle` (the server cannot verify it — it only uses it for duplicate
detection, FR-015).

**Rationale**: The preview needs server knowledge (existing imports, identities) to show
new/replaces/duplicate (FR-010, FR-016) without saving. Re-validating on commit enforces FR-013.
Per-file transactions match the per-file outcome model (a rejected file never blocks the others).

**Alternatives considered**: Single commit endpoint with client-side duplicate detection — would
require downloading all identities to the client and still re-checking server-side. Upload of the
PDF for server parsing — prohibited (FR-008).

## R7 — Request size limits

**Decision**: Disable Nest's default global body parser and register it explicitly in
`main.ts`: `json({ limit: '5mb' })` mounted for `/earnings/imports*` before the global
`json({ limit: '100kb' })` (the current default). Server-side limits: max 400 files per batch, max
2,000 records per file.

**Rationale**: A full-career companion export (≈170 records) or a 13-file batch exceeds Express's
100 kB default; raising the limit only for the import routes keeps the rest of the API unchanged.

**Alternatives considered**: Raising the global limit — widens every endpoint's attack surface.
Chunking on the client — breaks the batch preview's intra-batch conflict detection.

## R8 — Aggregation location and read API

**Decision**: The backend decrypts and aggregates with `libs/earnings` and exposes read models:
`GET /earnings/overview?employer=` (career, latest-year KPIs vs. same months of previous year,
yearly series, monthly series, deduction ratios, data-check summary count),
`GET /earnings/records?period=YYYY-MM` (month detail), `GET /earnings/tables?employer=` (year ×
month matrix for every metric, taxes per year, certificates), `GET /earnings/data-check?employer=`.
The frontend only maps these into ECharts options and tables.

**Rationale**: Principle II — business logic (money aggregation, fiscal rules, completeness,
late-correction exclusion) stays behind the API; the frontend stays a renderer. Payloads are small
(≈200 months per user).

**Alternatives considered**: Returning raw records and aggregating in the browser with the shared
lib — works (the lib is `scope:shared`) but moves money logic into the UI tier, which Principle II
discourages; keep the browser's use of the lib limited to parsing and pre-checks for the preview.

## R9 — Test material without real payslips

**Decision**: Three layers, none using real documents (constitution Principle IV amendment):

1. **Text fixtures** — synthetic `PdfDocumentText` objects (page lines) that reproduce the SAP
   Entgeltnachweis and Lohnsteuerbescheinigung layouts with invented figures, including
   correction sections, voluntary KV/PV, page breaks (GRUNDDATEN → next header), `Y551`. Used for
   exhaustive parser unit tests with exact-value assertions.
2. **Synthetic PDFs** — generated at test time with `pdfmake` (already a dependency) from the same
   invented layouts and run through the real `pdfjs-dist` extractor → parser, proving the
   serialization boundary end to end (Principle IV).
3. **Local parity check (not CI)** — `tools/earnings/parity-check.mjs` reads a directory given by
   an environment variable (the owner's real payslips, never committed), runs the TS parsers, and
   compares every record with earnings-evolution's `data/earnings.json`, printing only
   match/mismatch counts and field names (no amounts). Used to reach SC-002 before release.

**Rationale**: Real payslips are personal data and must never enter git; layered synthetic
fixtures still exercise every code path, and the parity script validates against reality locally.

**Alternatives considered**: Anonymizing real PDFs — error-prone (identifiers in many places,
metadata, fonts). Committing only text fixtures — would leave the PDF.js boundary untested.

## R10 — Companion export format (v1)

**Decision**: Define `earnings-export` schema v1 in
[contracts/earnings-export-v1.md](contracts/earnings-export-v1.md): top-level `schema`,
`version: 1`, `generated`, `records[]` and `certificates[]` with a closed set of keys, amounts in
integer cents (matching earnings-evolution's internal model). The browser reader validates it
strictly (unknown key anywhere → `EXPORT_UNKNOWN_FIELD`, unknown version →
`EXPORT_UNSUPPORTED_VERSION`), converts cents to decimal strings, runs the same checks, and
submits it through the same import endpoints with `sourceType: EXPORT_JSON`. The earnings-evolution
repository gets a matching `make export` (tracked there, outside this repo).

**Rationale**: One import pipeline for all sources; strict whitelisting enforces data minimization
(no `source` paths, `notes`, `items` labels, or document text).

**Alternatives considered**: Accepting earnings-evolution's full `earnings.json` — contains file
paths, notes, free-text item labels; violates data minimization.

## R11 — Frontend structure, charts, i18n

**Decision**: New `libs/frontend/domain/earnings` (`scope:frontend-domain`) following the Holdings
area pattern: `EarningsAreaComponent` (toolbar + sub-tabs) with child routes `overview`, `tables`,
`check`, `imports`, and a separate `import` route. Charts use the existing
`EchartComponent` from `@vaultfolio/frontend-shared-ui`; the five earnings series colors are added
to `chart-palette.ts` as named roles with light/dark variants. Texts go into the existing
`en.ts`/`de.ts` translation files under an `earnings.*` namespace, including the glossary (FR-047)
and one key per parser/check error code. Nav icon: Material Symbol `payments` (already in
`icon-name.map.ts`). New interactive elements get `data-testid`s per
`docs/frontend/testid-conventions.md`.

**Rationale**: Reuses every existing shell mechanism (domain registry, `domainGuard`, dashboard
widget registry, export registry, i18n service, chart wrapper); no new frontend infrastructure.

**Alternatives considered**: One long page like earnings-evolution — rejected in the UX review in
favor of sub-tabs (design.md).

## R12 — Entitlement, lifecycle, export integration

**Decision**:

- Add `earnings` to `DOMAIN_REGISTRY` (frontend) and `KNOWN_DOMAIN_IDS`
  (`apps/backend/src/accounts/accounts.service.ts`); it is **not** added to the `domain_scopes`
  default (`["holdings"]`). Controller uses `@RequiresDomain('earnings')`; every repository query
  filters by `owner_id` (admins pass the domain guard but only see their own rows — FR-003).
- `UsersRepository.deleteById` additionally deletes `earnings_records`, `earnings_certificates`,
  `earnings_employers`, `earnings_imports` for the user (purge after retention, FR-039); archiving
  changes nothing (data kept while restorable).
- Register an Earnings `FeatureExportDefinition` (029) whose `fetchData()` calls
  `GET /earnings/records` (all periods), so the full "Export my data" archive includes an
  `earnings/` folder automatically (FR-040).

**Rationale**: Same mechanisms as every existing domain; FR-002/FR-003/FR-039/FR-040.

**Observation (out of scope)**: `deleteById` currently does not delete `accounts` rows
(025-account-overview) — flag separately; this feature only adds its own tables.

## R13 — Transactions in `DatabaseService`

**Decision**: Add a small `transaction<T>(fn: () => T): T` helper to `DatabaseService` using
`better-sqlite3`'s `db.transaction`, used by the earnings repository for "replace records of an
identity", "save one file", "delete import", and "delete all". Foreign keys stay disabled
(unchanged app-wide); cascades are explicit deletes inside the transaction.

**Rationale**: Replace-and-insert must be atomic (FR-016); SQLite FK enforcement is currently off
(`PRAGMA foreign_keys` never set) and turning it on app-wide is out of scope.

**Alternatives considered**: Enabling `PRAGMA foreign_keys = ON` globally — could break existing
tables whose references were never enforced (e.g. `invitations.invited_by` after user deletion).

## R14 — Logging and error bodies

**Decision**: Request bodies are already never logged (`REQUEST_BODY_NEVER_LOGGED` in
`libs/observability`); `GlobalExceptionFilter` logs exception _messages_ and, for 5xx, the error
object. Earnings code therefore raises `BusinessException`s whose `message` is a fixed code-like
sentence and whose `details` hold only codes, file ids, periods, and check names — never amounts.
The service logs one structured line per import: `{ event: 'EarningsImport', importId,
fileSha256, parserId, parserVersion, records, outcome }` (constitution Principle V exception).
Rejection _differences_ (e.g. "12.40 €") are computed and shown in the browser only; the server
response for a failed check returns the difference to the caller but never logs it.

**Rationale**: FR-043 and the constitution's log-hygiene rule, using existing infrastructure.

## R15 — Correcting misread figures in the import preview (issue #63)

**Decision**:

- **Partial parse result.** `parseDocument` keeps rejecting a failing file with `CHECK_FAILED` but
  now attaches the parsed `employer`, `records` and `certificates` as `partial` (only for
  `CHECK_FAILED`; every other error stays figure-less). Parsers already return the records —
  only `registry.ts` discards them today.
- **All failures, not the first.** A new `collectCheckFailures(records)` in `checks.ts` returns
  every failing check with its record indexes, period, signed difference and the figures taking
  part (`involved`). `evaluateChecks` stays as is (server and registry keep their first-failure
  behavior).
- **Editable = involved in a failing check.** `NET`: `gross`, `wageTax`, `soli`, `churchTax`,
  `health`, `care`, `pension`, `unemployment`, `net`. `PAYOUT`: `net`, `payout`. `other` is derived
  by the parsers and is not editable; neither are bases, one-off or year-to-date figures.
- **Edit state lives in the browser only** (`ImportSessionStore` row), not on the server and not
  persisted; re-reading the file or leaving the page discards it.
- **Marker = figure names, not values.** The request carries `corrected: PayAmountKey[]` per
  record; it is stored inside the encrypted record payload (so existing rows and the schema are
  untouched) and `earnings_imports` gets a plain `corrected_count` so the history needs no
  decryption.
- **Only payslip PDFs.** `corrected` is rejected for `CERTIFICATE_PDF` (no checks) and
  `EXPORT_JSON` (the companion tool is the fix there).
- **Server stays authoritative.** It re-runs all checks on the submitted figures and validates
  `corrected` (known names from the editable set, no duplicates, only on `PAYSLIP_PDF`). It cannot
  know which figure was misread — a "fix" of the wrong figure that still balances is not
  detectable; the marker is the mitigation (spec edge case).

**Rationale**: Reuses the existing checks and whitelist; no new endpoint; nothing but a list of
known figure names is added to the payload, so data minimization and log hygiene stay intact.

**Alternatives considered**: A dedicated "correct" endpoint — duplicates preview/commit and moves
interpretation to the server. Persisting drafts server-side — stores unvalidated amounts. Letting
any figure be edited — turns the preview into manual entry (FR-004). Modal editor — only if the
grid becomes crowded (decided during UI work, see design.md addendum).

## R16 — Money input in the preview

**Decision**: `parseMoneyInput(text)` in `libs/earnings` accepts `1234.56`, `1.234,56`, `-45,00`
(German and English notation, optional thousands separators), rounds nothing (more than two
decimals → invalid) and returns the canonical money string or `null`. The input is a text field
with `inputmode="decimal"` rather than a number input, so locale parsing and exact decimals are
ours, not the browser's.

**Rationale**: Exact decimal strings end to end (constitution money rule); `type=number` yields
JS floats.
