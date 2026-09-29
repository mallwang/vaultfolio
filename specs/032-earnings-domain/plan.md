# Implementation Plan: Earnings Domain

**Branch**: `032-earnings-domain` | **Date**: 2026-09-29 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/032-earnings-domain/spec.md`

**Design**: [design.md](design.md) (approved mockup)

## Summary

A new Earnings domain that shows a user's employment income history (payslips, bonuses, wage tax,
social insurance, wage-tax certificates) with the overview known from the standalone
earnings-evolution app. Data enters **only by document import**: payslip and wage-tax certificate
PDFs are read **in the browser** with PDF.js and turned into figures by deterministic parsers
(first: SAP "Entgeltnachweis"; wage-tax certificate for any employer), and historic data comes
from the companion tool's versioned `earnings-export` JSON. Only whitelisted figures reach the
server, which re-runs the arithmetic checks, rejects any failing file as a whole, stores amounts
**AES-256-GCM-encrypted** per row, and serves owner-only read models (overview, tables, data
check, month detail). Parsers, checks and aggregations live in one new `scope:shared` library so
the same code runs in the browser and on the server.

## Technical Context

**Language/Version**: TypeScript (Node.js LTS backend, evergreen browsers)

**Primary Dependencies**: NestJS, Angular + PrimeNG, Nx; existing `decimal.js`, `echarts` (via
`shared-ui`'s `EchartComponent`), `pdfmake` (test-time synthetic PDFs). **One new dependency:
`pdfjs-dist`** (exact pinned version) for in-browser PDF text extraction (research R2). Encryption
uses `node:crypto` (no dependency).

**Storage**: SQLite via `DatabaseService` — four new tables (`earnings_imports`,
`earnings_records`, `earnings_certificates`, `earnings_employers`), monetary payloads encrypted in
`amounts_enc` (data-model.md). New `transaction()` helper on `DatabaseService` (research R13).

**Testing**: Jest (backend, `libs/earnings`), `@angular/build:unit-test` (frontend libs); exact
decimal-string assertions for all money; synthetic text fixtures + test-time generated synthetic
PDFs through the real PDF.js adapter; backend e2e-spec against a temp SQLite file; local-only
parity script against earnings-evolution (research R9). UI verified with the `verify-ui` skill.

**Target Platform**: Linux container (backend + embedded SQLite), evergreen browsers.

**Project Type**: web-service + frontend, Nx monorepo.

**Performance Goals**: Parse a typical payslip PDF in < 300 ms in the browser; a 13-file year
import including preview and commit completes in < 2 minutes end to end (SC-001); a full career
(≈ 260 files) stays responsive with visible progress (FR-022). Read models for ≈ 200 months
respond in < 300 ms.

**Constraints**: No document bytes/text leave the browser (FR-008); amounts never logged
(FR-043); fail closed without a valid key (FR-044); no external services for parsing (FR-045);
import routes accept up to 5 MB JSON, all other routes keep the 100 kB default (research R7).

**Scale/Scope**: 1 new shared library, 1 new frontend domain library, 1 backend module (~11
endpoints), 4 tables, 2 PDF parsers + 1 JSON reader, 5 screens + widget, EN/DE.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._ (Constitution v3.5.0)

- **I. Library-First** — Parsers, checks, export reader and all aggregations are framework-free in
  `libs/earnings`, testable without HTTP/UI. PASS.
- **II. API-First Interface** — All data flows through the documented `/earnings/*` API
  ([contracts/earnings-api.md](contracts/earnings-api.md)); money aggregation happens server-side
  (research R8). The browser runs parsers only to satisfy the constitution's on-device document
  rule; the backend re-validates every submission (FR-013). Structured error bodies via
  `libs/observability`. Types in `libs/api-contract`, OpenAPI DTOs + drift check, Bruno requests.
  PASS.
- **III. Test Coverage** — Every money path (parsing, cents conversion, checks, aggregations,
  latest-year comparison, data check, encryption round-trip) gets exact-value tests. PASS.
- **IV. Integration Testing** — Real serialization formats: synthetic PDFs through PDF.js, real
  JSON export files, HTTP e2e against SQLite. No real personal documents committed (v3.5.0
  amendment). PASS.
- **V. Observability, Versioning & Simplicity** — Sensitive-data exception applies: one metadata
  log line per import (id, hash, parser@version, counts, outcome), never amounts; parser and export
  format versioned. One new dependency (`pdfjs-dist`) justified in research R2; one small
  `DatabaseService.transaction()` helper justified in R13. PASS.
- **Product Scope** — Earnings is a listed planned domain; data origin is document import only;
  no manual entry of figures (FR-004); no bank/brokerage/payroll APIs. PASS.
- **Sensitive Personal Data** — Whitelist validation (unknown keys rejected), no server-side
  document handling, deterministic parsers without external services, owner-only queries (admins
  included), AES-256-GCM at rest with operator key and fail-closed behavior, log hygiene, delete
  per import/all, lifecycle purge, in-app privacy note. PASS.
- **Stack Decision** — SQLite single file; money as exact decimals, stored as ciphertext per the
  carve-out; ECharts only; Material Symbols (`payments`); new frontend domain library tagged
  `scope:frontend-domain` depending only on `scope:shared`. PASS.

Post-design re-check (after data-model/contracts): no new violations. The only boundary-relevant
choice — putting the shared earnings logic in `scope:shared` instead of `scope:domain` — follows
the existing rules (R1).

## Project Structure

### Documentation (this feature)

```text
specs/032-earnings-domain/
├── spec.md
├── design.md / mockup.html      # approved UX review
├── plan.md                      # this file
├── research.md                  # Phase 0
├── data-model.md                # Phase 1
├── quickstart.md                # Phase 1
├── contracts/
│   ├── earnings-api.md          # REST contract
│   ├── earnings-export-v1.md    # companion JSON format
│   └── earnings-lib.md          # @vaultfolio/earnings public API
└── tasks.md                     # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
libs/
├── earnings/                                  # NEW — @vaultfolio/earnings, scope:shared, framework-free
│   └── src/lib/
│       ├── model.ts                           # PayRecordInput, amounts, kinds, Money helpers (decimal.js)
│       ├── checks.ts                          # NET / PAYOUT checks (±0.01)
│       ├── validation.ts                      # strict whitelist validation of import files
│       ├── parsers/
│       │   ├── pdf-text.ts                    # PdfDocumentText types + line helpers
│       │   ├── registry.ts                    # PARSER_REGISTRY, parseDocument()
│       │   ├── sap-entgeltnachweis.ts         # port of earnings-evolution evosoft.py
│       │   └── lohnsteuerbescheinigung.ts     # official form, any employer
│       ├── export-v1.ts                       # readEarningsExport()
│       ├── aggregations/                      # monthly, yearly, career, latest-year, grid, taxes, data-check
│       └── testing/                           # synthetic text fixtures (invented figures) + expected values
├── api-contract/src/lib/earnings.ts           # NEW — request/response/read-model types
└── frontend/domain/earnings/                  # NEW — @vaultfolio/frontend-domain-earnings, scope:frontend-domain
    └── src/lib/
        ├── earnings-area/                     # toolbar (employer filter, export, import) + sub-tabs
        ├── overview/                          # career accordion, KPI tiles, 3 charts, month detail
        ├── tables/                            # month grid, taxes per year, certificates
        ├── data-check/
        ├── imports/                           # privacy note, history, employer names, delete all
        ├── import/                            # dropzone, per-file preview, confirm
        ├── pdf/pdf-text-extractor.ts          # pdfjs-dist adapter → PdfDocumentText (+ file SHA-256)
        ├── earnings-dashboard-widget/
        ├── earnings-export.definition.ts      # 029 FeatureExportDefinition
        ├── earnings.service.ts                # HTTP client for /earnings/*
        └── testing/                           # synthetic PDF generator (pdfmake) for adapter tests

apps/backend/src/
├── earnings/                                  # NEW module
│   ├── earnings.module.ts / .controller.ts / .service.ts
│   ├── earnings.repository.ts                 # owner-scoped SQL, transactions
│   ├── earnings-crypto.service.ts             # AES-256-GCM, key validation, availability flag
│   └── *.spec.ts
├── database/database.service.ts               # MODIFIED — 4 tables + transaction() helper
├── accounts/accounts.service.ts               # MODIFIED — 'earnings' in KNOWN_DOMAIN_IDS
├── auth/users.repository.ts                   # MODIFIED — purge earnings tables in deleteById
├── openapi/dto/earnings.ts                    # NEW — Swagger DTOs (drift check)
├── main.ts                                    # MODIFIED — explicit body parsers (5 MB for imports)
├── app/app.module.ts                          # MODIFIED — register EarningsModule
└── tests/earnings.e2e-spec.ts                 # NEW — import → read → isolation → delete, fail-closed

apps/frontend/src/app/
├── app.routes.ts                              # MODIFIED — /app/earnings (+ children), domainGuard('earnings')
├── dashboard/dashboard-widgets.registry.ts    # MODIFIED — earnings widget
└── export/feature-export.registry.ts          # MODIFIED — earnings export definition

libs/frontend/domain-access/src/lib/domain-registry.ts   # MODIFIED — earnings entry (icon payments)
libs/frontend/shared-ui/src/lib/i18n/translations/{en,de}.ts  # MODIFIED — earnings.* keys, glossary, error codes
libs/frontend/shared-ui/src/lib/chart/chart-palette.ts   # MODIFIED — five earnings series roles (light/dark)
api/bruno/earnings/                            # NEW — requests for every endpoint
tools/earnings/parity-check.mjs                # NEW — local-only parity against earnings-evolution
.env.example, docker-compose*.yml, README(.de).md, docs/user-guide(.de).md  # MODIFIED — key + feature docs
```

**Structure Decision**: One new `scope:shared` library (`libs/earnings`) holds everything that
must run in both tiers (research R1); one new `scope:frontend-domain` library holds the UI and the
browser-only PDF adapter; the backend module mirrors `holdings`/`account-overview` (controller /
service / repository) plus a crypto service. The companion tool's `make export` is implemented in
the separate earnings-evolution repository against
[contracts/earnings-export-v1.md](contracts/earnings-export-v1.md).

## Complexity Tracking

No constitution violations. Recorded justifications (Principle V):

| Addition                           | Why needed                                              | Simpler alternative rejected because                                        |
| ---------------------------------- | ------------------------------------------------------- | --------------------------------------------------------------------------- |
| `pdfjs-dist` dependency            | PDF text extraction must happen in the browser (FR-008) | No platform API extracts PDF text; server-side parsing is prohibited        |
| `libs/earnings` as `scope:shared`  | Same parsers/checks in browser and backend              | `scope:domain` is not importable by frontend domain libs                    |
| `DatabaseService.transaction()`    | Atomic replace/delete across tables                     | FKs are disabled app-wide; manual BEGIN/COMMIT per call site is error-prone |
| Explicit body parsers in `main.ts` | Import batches exceed Express's 100 kB default          | Raising the global limit widens every endpoint                              |
