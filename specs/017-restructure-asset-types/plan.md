# Implementation Plan: Restructure Asset Types (Precious Metal / Crypto)

**Branch**: `017-restructure-asset-types` | **Date**: 2026-09-04 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/017-restructure-asset-types/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Renames the `GOLD`/`BITCOIN` asset types introduced by 003-manual-holdings-entry to
`PRECIOUS_METAL`/`CRYPTO` and gives both a required, free-text `name` field — reusing the `name`
field ETF/Share already have — so a holding can be "Silver" or "Ethereum", not just "Gold" or
"Bitcoin" (FR-001–FR-004). Precious metal keeps its existing update-in-place merge behavior, now
keyed by `(name, management)` instead of `management` alone (FR-005); Crypto keeps its existing
per-lot, never-merge behavior (FR-006). Every existing `GOLD`/`BITCOIN` row is migrated exactly
once, on backend startup, to `PRECIOUS_METAL`/`CRYPTO` with `name` set to `"Gold"`/`"Bitcoin"`
respectively, with every other field preserved (FR-007, FR-008, User Story 3) — implemented as a
table-rebuild migration inside `DatabaseService`, since SQLite cannot `ALTER` a `CHECK`
constraint's expression in place (research.md #1). The UX review for this feature also surfaced
two corrections to the shipped app's deviation from 003-manual-holdings-entry's own approved
design: the add-holding dialog's asset-type control becomes a button/card selector instead of a
`p-select` dropdown (FR-012), and the "Distribution by value" panel — originally designed to
appear on the Holdings page and relocated to the Dashboard only during 003's implementation — is
restored to the Holdings page as well (FR-013), grouped individually by holding name for Precious
metal/Crypto rather than summed per type (FR-010, research.md #3). Per Principle I, all of the
renaming/validation/merge-key logic lives in the existing `libs/domain/holdings` library (amended
in place, not a new library); per Principle II, the REST contract change is documented as an
amendment to 003's `holdings-api.md` before implementation, versioned as a breaking `2.0.0` change.

## Technical Context

**Language/Version**: TypeScript (Node.js LTS runtime for the backend)

**Primary Dependencies**: NestJS (backend), Angular (frontend), Nx (monorepo tooling), PrimeNG
(already wired up), `decimal.js` (exact decimal handling, already a dependency), `better-sqlite3`
(already a dependency, per 004-sqlite-migration). **No new runtime dependency** — this feature is
a rename/field-addition/migration within the existing Holdings stack, not new capability.

**Storage**: SQLite, a single file at `DATABASE_PATH`, accessed only via the backend (Principle
II) — per the constitution's Stack Decision (superseding 003's original PostgreSQL target, per
004-sqlite-migration). The `holdings` table is rebuilt in place by a new migration step (see
[research.md](./research.md) #1, [data-model.md](./data-model.md)'s Persistence section) — `TEXT`
columns throughout, never `REAL`, unchanged from the existing pattern.

**Testing**: Jest — unit tests for `libs/domain/holdings`'s amended validation/merge rules
(Principle III, exact-decimal assertions), a unit test for `DatabaseService`'s new migration step
(idempotency: running it twice produces no further change, matching the existing
`database.service.spec.ts` pattern for `migrateAuth`/`migrateProfile`/`migrateI18n`), backend
service/repository unit tests, an updated `apps/backend/src/tests/holdings.e2e-spec.ts` (renamed
types, new required `name` field, the `(name, management)` upsert contract test per
[contracts/holdings-api-asset-types.md](./contracts/holdings-api-asset-types.md)), and Angular
component tests for the holdings list/form/distribution changes (type selector, name field,
per-name grouping).

**Target Platform**: Linux server (backend + bind-mounted SQLite file), modern evergreen browsers
(Angular frontend)

**Project Type**: web-service + frontend, Nx monorepo (see Project Structure below)

**Performance Goals**: SC-004's <1s validation-rejection latency — already met by the existing
synchronous in-process validation path (`validateHoldingSubmission`); no new performance work.

**Constraints**: The startup migration (FR-008) MUST be safe to run on every boot without
re-applying — addressed by the `sqlite_master`-text idempotency guard in research.md #1, consistent
with this table's existing risk profile (dozens–low hundreds of rows per user, per 003's
Scale/Scope — a full-table rebuild at that size is a sub-millisecond operation, not a migration
requiring batching/progress reporting).

**Scale/Scope**: Same per-user dataset scale as 003 (dozens–low hundreds of holdings); this
feature changes no scale assumption.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle                                | Check                                                                                                                                                                                                                                                                                                                                                                                                                                   | Status |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| I. Library-First                         | The renamed types, the `name`-required rule, and the `(name, management)` merge key all live in `libs/domain/holdings` (amended `asset-type.ts`, `holding-validation.ts`, `holding-merge.ts`), independent of NestJS/Angular, covered by the library's existing unit-test suite.                                                                                                                                                        | PASS   |
| II. API-First Interface                  | The breaking REST contract change is documented in [contracts/holdings-api-asset-types.md](./contracts/holdings-api-asset-types.md) (versioned `2.0.0`) before implementation; frontend calls only this API; errors keep the existing structured `VALIDATION_FAILED`/`HOLDING_NOT_FOUND` shapes.                                                                                                                                        | PASS   |
| III. Test Coverage                       | Implementation-then-test ordering (per this project's relaxed Principle III), but coverage is not optional: the amended merge-key logic and the migration's field preservation (weight/quantity/price/date/current-value) get exact-decimal assertions, never approximate.                                                                                                                                                              | PASS   |
| IV. Integration Testing                  | `holdings.e2e-spec.ts` is updated (real HTTP requests) to cover the renamed types' full CRUD + upsert contract; a new `database.service.spec.ts` case exercises the migration itself (pre-migration fixture rows → real SQLite file → assert post-migration shape and idempotency on a second run).                                                                                                                                     | PASS   |
| V. Observability, Versioning, Simplicity | Existing create/update/delete structured logging (id, asset type, Management, outcome) continues unchanged, now logging the new type names; the migration logs its own outcome (rows migrated, or "already migrated, skipped") per the established `DatabaseService` logging pattern; contract bumps to `2.0.0` (breaking); no new abstraction introduced — the table rebuild reuses the existing raw-`better-sqlite3` pattern, no ORM. | PASS   |

No violations — Complexity Tracking is not needed.

## Project Structure

### Documentation (this feature)

```text
specs/017-restructure-asset-types/
├── plan.md                              # This file
├── research.md                          # Phase 0 output
├── data-model.md                        # Phase 1 output — amends 003's data-model.md
├── design.md                            # UX-review output (already written, pre-plan)
├── mockup.html                          # UX-review output (already written, pre-plan)
├── quickstart.md                        # Phase 1 output
├── contracts/
│   └── holdings-api-asset-types.md      # Phase 1 output — amends 003's holdings-api.md
└── tasks.md                             # Phase 2 output (/speckit-tasks — not created here)
```

### Source Code (repository root)

```text
apps/
├── backend/
│   └── src/
│       ├── database/
│       │   ├── database.service.ts              # + migrateAssetTypeRestructure() (research.md #1)
│       │   └── database.service.spec.ts          # + migration idempotency test
│       ├── holdings/
│       │   ├── holdings.repository.ts            # findUpsertMatch(): PRECIOUS_METAL branch (research.md #2)
│       │   ├── holdings.repository.spec.ts
│       │   ├── holdings.service.ts                # GOLD → PRECIOUS_METAL in the upsert-lookup branch
│       │   └── holdings.controller.spec.ts
│       ├── auth/
│       │   └── users.repository.spec.ts           # GOLD fixture → PRECIOUS_METAL (research.md #4)
│       └── tests/
│           ├── holdings.e2e-spec.ts                # renamed types, name field, updated upsert test
│           └── holdings-persistence.e2e-spec.ts
└── frontend/
    └── src/app/holdings/
        ├── asset-type-fields.ts                    # ASSET_TYPES, field sets, labels (frontend mirror)
        ├── holding-form/
        │   ├── holding-form.component.ts            # type selector control → button/card group (FR-012)
        │   ├── holding-form.component.html
        │   └── holding-form.component.spec.ts
        ├── holdings.component.ts                    # + <app-holdings-distribution> on this page (FR-013)
        ├── holdings.component.html
        ├── holdings.component.spec.ts
        └── holdings-distribution/
            ├── holdings-distribution.component.ts    # recompute(): group by name for PM/Crypto (research.md #3)
            └── holdings-distribution.component.spec.ts

libs/
├── domain/holdings/src/lib/
│   ├── asset-type.ts              # AssetType union, ASSET_TYPE_FIELDS — rename + name required
│   │                               # (no separate spec file — covered via holding-validation.spec.ts)
│   ├── holding.ts                 # computeValue(): 'GOLD' → 'PRECIOUS_METAL' check
│   ├── holding-merge.ts           # decideMerge(): PRECIOUS_METAL name+management branch
│   ├── holding-merge.spec.ts
│   ├── holding-validation.ts      # required-field rule additions
│   └── holding-validation.spec.ts
└── api-contract/src/lib/
    └── holdings.ts                # AssetType union, Create*/Update*HoldingRequest renames

apps/frontend/src/app/core/i18n/translations/
├── en.ts                          # asset type labels, name-field label reuse, empty-state copy
└── de.ts                          # same, German
```

**Structure Decision**: No new Nx apps/libs. This feature amends the existing `libs/domain/holdings`
(rename + validation/merge rule changes), `libs/api-contract` (shared type rename), and the
existing `apps/backend`/`apps/frontend` Holdings modules 003-manual-holdings-entry introduced —
consistent with 003's own Structure Decision, since this is that feature's asset-type model being
revised in place, not a new capability needing its own boundary.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations — table not needed.
