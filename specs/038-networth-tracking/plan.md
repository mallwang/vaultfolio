# Implementation Plan: Vermögensentwicklung (Net-Worth Tracking)

**Branch**: `038-networth-tracking` | **Date**: 2026-10-04 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/038-networth-tracking/spec.md`; approved layout in [design.md](design.md)

## Summary

The registered but empty **Historic Wealth Development** domain becomes a real domain. A user records
**snapshots** (Stichtage): each is a reference date with any number of entries, every entry having a
name, a side (asset or liability), a class (a suggested one or free text) and a non-negative amount.
From the snapshots the page derives the net worth over time, a breakdown by class, change versus the
previous snapshot, a personal **balance sheet** (Aktiva/Passiva grouped by balance groups, equity as
the balancing figure), a dashboard tile and a PDF report. Everything is entered by hand; there is no
import and no link to Holdings in this version.

Technical approach: (1) a new framework-independent lib `@vaultfolio/wealth` holds the model, strict
whitelist validation, the standard classes and their default balance groups, and all derivations
(totals, series, changes, breakdown, balance sheet) so overview, tile, PDF and balance sheet cannot
disagree (SC-005, Principle I); (2) a NestJS `wealth` module mirrors the Retirement module
(controller, service, repository, crypto service, availability guard) with one row per snapshot and
one settings row per user, entry names and amounts only inside an AES-256-GCM payload under a
dedicated operator key `WEALTH_ENCRYPTION_KEY`, fail-closed when it is missing; (3) the existing
Angular lib `libs/frontend/domain/historic-wealth-development` replaces its placeholder with the
area (Entwicklung and Bilanz tabs), the snapshot form, the dashboard widget and a real export
definition; ECharts, already used by Earnings and Holdings, draws the chart on screen and for the PDF.

## Technical Context

**Language/Version**: TypeScript (Angular frontend, NestJS backend), Nx monorepo

**Primary Dependencies**: existing `decimal.js`, `echarts`, PrimeNG, `@vaultfolio/export` — **no new third-party dependency**. One new internal lib: `@vaultfolio/wealth`. `echarts` is declared in the wealth frontend lib's own `package.json` (as Earnings does).

**Storage**: SQLite via backend — two new tables: `wealth_snapshots` (one row per snapshot, unique `(owner_id, snapshot_date)`) and `wealth_settings` (one row per owner, class-to-group assignments). Idempotent `CREATE TABLE IF NOT EXISTS`, owner-scoped. Entry names, classes, amounts, note and group assignments live only inside the encrypted `payload_enc`; the one plain lookup column besides ids and timestamps is the snapshot date.

**Testing**: Jest for `@vaultfolio/wealth` and the backend; Angular unit-test runner for the frontend lib; exact-decimal tests with fixed expectations for totals, changes and the balance sheet; backend e2e for the API incl. owner isolation, duplicate date, fail-closed key, whitelist; Playwright check via `verify-ui`

**Target Platform**: Linux server (backend), modern evergreen browsers (frontend)

**Project Type**: web-service + frontend Nx monorepo

**Performance Goals**: list, chart, table, balance sheet and tile render within 2 s for 120 snapshots × ≈ 30 entries (SC-003); the list endpoint decrypts ≤ 600 small rows, which is negligible

**Constraints**: no amounts or entry names in logs; whitelist-only payloads; no external service; fail closed without key; amounts as decimal strings end to end; at most 600 snapshots per user and 200 entries per snapshot

**Scale/Scope**: one user: typically 4–120 snapshots with 5–30 entries each

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle / rule                          | Assessment                                                                                                                                                                                                                                                         |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| I. Library-First                          | Model, validation, standard classes, groups and every derivation live in `@vaultfolio/wealth` (no NestJS/Angular imports). PASS                                                                                                                                    |
| II. API-First                             | New `/wealth` REST surface with OpenAPI DTOs and the existing drift/completeness checks; frontend talks only via `@vaultfolio/api-contract` types. PASS                                                                                                            |
| III. Test Coverage                        | Totals, net worth, changes (incl. "n/a" rule), breakdown and balance sheet involve money → exact-decimal tests; ≥ 80 % per project via the coverage audit. PASS                                                                                                    |
| IV. Integration Testing                   | Backend e2e (persistence, isolation, unique date, 503, whitelist, delete-all); export integration test for the PDF sections. No real personal data committed. PASS                                                                                                 |
| V. Observability, Versioning & Simplicity | Logs carry snapshot id, entry count and outcome only. Two tables, one module, no new third-party dependency. PASS                                                                                                                                                  |
| Sensitive Personal Data                   | The rule already covers "any future domain holding comparably sensitive personal data": whitelist-only payloads, owner-only queries, encryption at rest, log hygiene, delete one / delete all. Entry names are free text and are encrypted like amounts. PASS      |
| Product Scope — domain list               | Historic Wealth Development is a listed planned domain; the scope text needs a bullet for it and a naming of its manual entry under the sensitive-data rules → constitution **MINOR bump 3.10.0** as the first task (see Complexity Tracking). PASS with amendment |
| Out of Scope — data-origin rule           | Manual entry only; no bank, broker or Holdings pull. PASS                                                                                                                                                                                                          |
| Nx boundaries                             | Domain lib depends only on `scope:shared` libs (`@vaultfolio/wealth`, `api-contract`, `export`, `frontend-shared-ui`). PASS                                                                                                                                        |
| Stack — Money/decimal                     | Decimal strings in DTOs and payload, `decimal.js` for sums; ciphertext at rest. PASS                                                                                                                                                                               |

**Post-design re-check (Phase 1)**: unchanged. The data model keeps entry names, classes, amounts, the
note and group assignments inside ciphertext; plain columns hold only ids, owner, snapshot date,
key version and timestamps. Derivations are pure functions in the lib and are not persisted, so no
total can drift from its entries. PASS.

## Project Structure

### Documentation (this feature)

```text
specs/038-networth-tracking/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── design.md / mockup.html
├── contracts/
│   ├── wealth-api.md
│   └── wealth-lib.md
├── checklists/requirements.md
└── tasks.md              # /speckit-tasks (not created here)
```

### Source Code (repository root)

```text
libs/wealth/                              # NEW (scope:shared) — pure domain logic
└── src/lib/
    ├── model.ts                          # Snapshot, Entry, ClassRef, Side, BalanceGroup, Money
    ├── classes.ts                        # standard classes per side + default balance groups
    ├── validation.ts                     # strict whitelist + rules (FR-001–FR-006, FR-017)
    ├── summary.ts                        # totals, net worth, changes, per-class series, period filter
    ├── balance-sheet.ts                  # grouping, sub-totals, equity, balance check (FR-023–FR-026)
    └── testing/builders.ts               # snapshot/entry builders for tests

libs/api-contract/src/lib/wealth.ts       # DTO types shared by backend & frontend
apps/backend/src/wealth/                  # NEW module
├── wealth.module.ts, wealth.controller.ts, wealth.service.ts, wealth.repository.ts
├── wealth-crypto.service.ts, wealth-available.guard.ts, wealth.exceptions.ts
apps/backend/src/{app/app.module.ts,database/database.service.ts,auth/users.repository.ts,openapi/dto/wealth.ts}
apps/backend/src/tests/wealth.e2e-spec.ts, wealth-e2e.helpers.ts

libs/frontend/domain/historic-wealth-development/src/lib/   # replaces the placeholder
├── wealth.service.ts                     # HTTP
├── wealth-area/ (tabs, available guard, unavailable)
├── development/ (kpis, chart panel, snapshot table, single-snapshot, empty state)
├── balance/ (balance-sheet view, group selector)
├── snapshot-form/ (date, copy-from, positions, class suggestions, group prompt, sum box)
├── charts/wealth-charts.ts               # ECharts option builder (screen + PDF)
├── wealth-dashboard-widget/
├── wealth-export.definition.ts           # real provider (replaces the disabled placeholder)
└── wealth-pdf-sections.ts
apps/frontend/src/app/{app.routes.ts,dashboard/dashboard-widgets.registry.ts,export/feature-export.registry.ts,core/layout/application-areas.ts}
libs/frontend/shared-ui/src/lib/i18n/translations/{wealth.de.ts,wealth.en.ts,wealth-translations.spec.ts}

.specify/memory/constitution.md           # 3.10.0 amendment (first task)
.env.example, docker-compose.yml, docker-compose.portainer.yml, README(.de).md, docs/user-guide(.de).md
docs/frontend/testid-conventions.md       # new data-testids follow the convention
```

**Structure Decision**: One new Nx lib (`@vaultfolio/wealth`), one new backend module and the existing
Historic Wealth Development frontend lib. Retirement's structure is mirrored on purpose so
reviewers and the existing guards, e2e helpers and key handling transfer directly. The placeholder
component and the disabled export definition are removed, not kept.

## Complexity Tracking

| Violation / extra structure                        | Why Needed                                                                                                                       | Simpler Alternative Rejected Because                                                                          |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Separate `WEALTH_ENCRYPTION_KEY`                   | Independent key lifecycle and blast radius per sensitive domain, same as Earnings and Retirement                                 | Reusing another domain's key couples availability and rotation of two domains                                 |
| Constitution amendment (MINOR 3.10.0)              | Product Scope must say what the Historic Wealth Development domain does and that its manual data falls under the sensitive rules | Leaving the domain as a bare placeholder in the constitution would make the plan contradict the governing doc |
| `wealth_settings` table besides `wealth_snapshots` | Class-to-group assignments are per user across all snapshots (FR-026) and class names are user text that must stay encrypted     | Storing the group per entry violates FR-026; a plain `class` column would expose user-written labels          |

Risks noted: (1) ECharts must draw liabilities visibly distinct from assets in both themes and in the
PDF raster (hatch via decal plus a distinct color, so print without color still works); (2) the PDF
differs slightly from the mockup: the section-based renderer draws the chart full width and the
class table as its own table section rather than side by side; (3) the "suggested class" list and
group names are translated, so entries store a standard class id and not its German label (R4).
