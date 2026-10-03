# Implementation Plan: Altersvorsorge (Retirement Planning)

**Branch**: `037-altersvorsorge-retirement-planning` | **Date**: 2026-10-03 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/037-altersvorsorge-retirement-planning/spec.md`; approved layout in [design.md](design.md)

## Summary

The registered but empty **Retirement** domain becomes a real domain: a user records German
retirement provision across three pillars — the statutory pension (DRV Renteninformation), any
number of occupational contracts and any number of private contracts (Riester, private pension
insurance, Altersvorsorgedepot) — and sees an overview, per-pillar cards, a dashboard tile and a
static "further information" tab. Records enter either by **uploading the provider's PDF**
(interpreted on the device by deterministic, label-based parsers with the existing consented
on-device OCR fallback; the user reviews the figures; imported figures are read-only) or by manual
entry (always editable). Data is owner-only and stored like Earnings: monetary amounts **and**
insurance/contract numbers in an AES-256-GCM encrypted payload under a dedicated operator key
(`RETIREMENT_ENCRYPTION_KEY`), fail-closed when the key is missing.

Technical approach: (1) a new framework-independent lib `@vaultfolio/retirement` holds the model,
whitelist validation, plausibility checks, three parsers and the summary aggregation (Principle I);
(2) the PDF text types, OCR normalisation, PDF.js extraction and tesseract recogniser that Earnings
owns today move into two small shared libs so Retirement can reuse them without breaking the Nx
domain boundary — a behaviour-neutral refactor done first; (3) a NestJS `retirement` module mirrors
the Earnings module (controller, service, repository, crypto service, availability guard) behind a
whitelisted REST contract; (4) the Angular domain lib replaces the placeholder with the area, forms,
import flow, widget and export definition.

## Technical Context

**Language/Version**: TypeScript (Angular frontend, NestJS backend), Nx monorepo

**Primary Dependencies**: existing `decimal.js`, `pdfjs-dist` 6.3.289, `tesseract.js` (+ German data) — all already in the repo; **no new third-party dependency**. New internal libs: `@vaultfolio/document-text`, `@vaultfolio/retirement`, `@vaultfolio/frontend-document-reader`

**Storage**: SQLite via backend — one new table `retirement_records` (idempotent `CREATE TABLE IF NOT EXISTS`, owner-scoped); monetary figures and identifiers only inside the encrypted `payload_enc`; plain columns only for non-monetary lookup (pillar, type, origin, status, provider label, dates)

**Testing**: Jest (libs, backend) and Angular unit-test runner (frontend libs) per existing targets; parsers tested against **synthetic documents that reproduce the real layouts** (never the user's real PDFs, Principle IV); backend e2e for the API incl. owner isolation, read-only imports, fail-closed key; Playwright check via `verify-ui`

**Target Platform**: Linux server (backend), modern evergreen browsers (frontend; WASM OCR already shipped)

**Project Type**: web-service + frontend Nx monorepo

**Performance Goals**: overview/summary renders instantly for ≤ 30 records (decrypt-per-row is negligible); import review appears within a few seconds for text PDFs and within the existing ≈ 4–6 s/page for scanned pages, UI stays responsive

**Constraints**: document and extracted text never leave the device; only whitelisted figures + identifiers the user confirmed are sent; no amounts/identifiers in logs; no external service; OCR assets same-origin only; fail closed without key

**Scale/Scope**: one user: 1 statutory record, ≈ 1–10 occupational and ≈ 1–5 private records; 3 parsers at launch (DRV Renteninformation, private/Riester annual statement, employer capital-account statement) with manual fallback for everything else

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle / rule                             | Assessment                                                                                                                                                                                                                                                                      |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I. Library-First                             | Model, validation, checks, parsers and summary live in `@vaultfolio/retirement` (no NestJS/Angular imports); text types/normalisation in `@vaultfolio/document-text`; browser reading in `@vaultfolio/frontend-document-reader`. PASS                                           |
| II. API-First                                | New `/retirement` REST surface with OpenAPI DTOs and drift/completeness checks; frontend talks only via `@vaultfolio/api-contract` types. PASS                                                                                                                                  |
| III. Test Coverage                           | Summary sums, plausibility checks and parser extraction involve money → exact-decimal tests with fixed expectations; ≥ 80 % per project via the coverage audit. PASS                                                                                                            |
| IV. Integration Testing                      | Backend e2e (persistence, isolation, read-only rule, 503); parser tests on synthetic documents replicating real layouts; no real personal document committed (`tmp/` is gitignored). PASS                                                                                       |
| V. Observability, Versioning & Simplicity    | Logs carry record id, pillar, type, parser id/version, outcome — no amounts, no identifiers. One table, one module, no new third-party dependency. PASS                                                                                                                         |
| Sensitive Personal Data (constitution 3.9.0) | Whitelist-only payloads (unknown field → 400); no document handling on the server; deterministic parsers, on-device consented OCR; owner-only queries; encrypted payload incl. identifiers (the 3.9.0 Retirement exception); delete one / delete all; in-app privacy note. PASS |
| Product Scope — Retirement In Scope (3.9.0)  | Matches the scope bullets; no provider/DRV API, no tax or pension-gap calculation. PASS                                                                                                                                                                                         |
| Out of Scope — data-origin rule              | Manual entry and the user's own uploaded document are the only origins. PASS                                                                                                                                                                                                    |
| Nx boundaries                                | `scope:frontend-domain` may depend only on `scope:shared`: Retirement must not import Earnings' frontend lib → the shared reader lib is required (see Complexity Tracking). PASS after refactor                                                                                 |
| Stack — Money/decimal                        | Decimal strings end-to-end, ciphertext at rest (the sensitive-data carve-out). PASS                                                                                                                                                                                             |

**Post-design re-check (Phase 1)**: unchanged. The data model keeps every amount and identifier inside
the ciphertext; plain columns hold only pillar/type/origin/status/label/dates. The supplement
mechanism (R5) keeps imported figures immutable while allowing the fields the document does not
print. PASS.

## Project Structure

### Documentation (this feature)

```text
specs/037-altersvorsorge-retirement-planning/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── design.md / mockup.html
├── contracts/
│   ├── retirement-api.md
│   ├── retirement-lib.md
│   └── document-reader.md
├── checklists/requirements.md
└── tasks.md              # /speckit-tasks (not created here)
```

### Source Code (repository root)

```text
libs/document-text/                      # NEW (scope:shared) — moved from @vaultfolio/earnings, behaviour-neutral
└── src/lib/{pdf-text.ts,amount-tokens.ts,ocr-normalise.ts}   # PdfDocumentText & friends, German amount/date tokens, OCR digit normalisation
libs/earnings/src/lib/parsers/pdf-text.ts, ocr-normalise.ts   # become re-exports of @vaultfolio/document-text

libs/frontend/document-reader/           # NEW (scope:shared) — moved from frontend-domain-earnings/pdf
└── src/lib/{pdf-text-extractor.ts,read-blob.ts,text-recogniser.ts,tesseract-recogniser.ts,
             ocr-layout.ts,text-recogniser.token.ts,text-recogniser.testing.ts,ocr-consent/}
libs/frontend/domain/earnings/src/lib/pdf/                    # imports switched to the shared lib

libs/retirement/                         # NEW (scope:shared) — pure domain logic
└── src/lib/
    ├── model.ts                         # pillars, contract types, figures, supplement, Money
    ├── validation.ts                    # strict whitelist + per-type rules (FR-006)
    ├── checks.ts                        # plausibility checks (shared by parsers, server)
    ├── summary.ts                       # totals, flags (outdated/incomplete), earliest start (FR-007–FR-010)
    ├── parsers/{registry.ts,drv-renteninformation.ts,private-statement.ts,capital-account-statement.ts}
    ├── resources.ts                     # static "further information" list (FR-012)
    └── testing/{builders.ts,*.fixtures.ts}   # synthetic documents reproducing real layouts

libs/api-contract/src/lib/retirement.ts  # DTO types shared by backend & frontend
apps/backend/src/retirement/             # NEW module
├── retirement.module.ts, retirement.controller.ts, retirement.service.ts, retirement.repository.ts
├── retirement-crypto.service.ts, retirement-available.guard.ts, retirement.exceptions.ts
apps/backend/src/shared/field-crypto.ts  # AES-256-GCM primitive extracted from earnings-crypto (R3)
apps/backend/src/{app/app.module.ts,database/database.service.ts,auth/users.repository.ts,openapi/dto/retirement.ts}
apps/backend/src/tests/retirement.e2e-spec.ts, retirement-e2e.helpers.ts

libs/frontend/domain/retirement/src/lib/ # replaces the placeholder
├── retirement.service.ts                # HTTP
├── retirement-area/ (tabs, available guard, unavailable)
├── overview/, pillar/, contract-card/, record-form/, import/ (store + steps), info/, privacy-note/
├── retirement-dashboard-widget/
└── retirement-export.definition.ts      # real data provider (replaces the empty placeholder)
apps/frontend/src/app/{app.routes.ts,dashboard/dashboard-widgets.registry.ts,export/feature-export.registry.ts}
libs/frontend/shared-ui/src/lib/i18n/translations/{retirement.de.ts,retirement.en.ts,retirement-translations.spec.ts}

.env.example, docker-compose.yml, docker-compose.portainer.yml, README(.de).md, docs/user-guide(.de).md
docs/frontend/testid-conventions.md      # new data-testids follow the convention
```

**Structure Decision**: Three new Nx libs (pure retirement logic; shared text types; shared browser
reader) plus one new backend module and the existing Retirement frontend lib. The two shared libs
exist only because the Nx boundary forbids Retirement from importing the Earnings frontend lib and
because duplicating the OCR stack (≈ 5–8 MB assets, worker code) would be worse. Earnings is
migrated to them first, with no behaviour change, so every later task builds on stable imports.

## Complexity Tracking

| Violation / extra structure                      | Why Needed                                                                                                                         | Simpler Alternative Rejected Because                                                                                   |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Two new shared libs + refactor of Earnings       | Retirement needs the same PDF text types, extractor and OCR as Earnings; `scope:frontend-domain` may only depend on `scope:shared` | Importing `frontend-domain-earnings` breaks the Nx boundary; copying the OCR adapter duplicates ≈ 8 MB assets and code |
| Separate `RETIREMENT_ENCRYPTION_KEY`             | Independent key lifecycle and blast radius per sensitive domain; operator can enable one domain without the other                  | Reusing `EARNINGS_ENCRYPTION_KEY` couples two domains' availability and key rotation                                   |
| Shared `field-crypto.ts` extracted from Earnings | Avoid a second copy of AEAD code                                                                                                   | Copy-paste of crypto code is a maintenance and audit risk                                                              |

Risks noted: (1) OCR accuracy on the scanned Renteninformation — mitigated by the deterministic
plausibility checks (earnings points × pension value = accrued pension; monotonic scenarios) that
reject misreads as a whole, plus manual fallback; (2) parser coverage — three layouts at launch,
others fall back to manual entry by design (spec FR-002d); (3) Altersvorsorgedepot rules are not
final before 2027 — modelled generically.
