# Implementation Plan: Deposit Money Asset Type

**Branch**: `018-deposit-money` | **Date**: 2026-09-04 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/018-deposit-money/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Add `DEPOSIT_MONEY` as a fifth `AssetType` so users can record fiat cash balances (bank accounts,
cash at home, broker/robo-advisor reference-account cash) as holdings — required `name` +
`currentValue` (>= 0), reusing the existing `management` field, no quantity/price/ISIN/purchase-
date/weight fields. It upserts on `(name, management)` like `PRECIOUS_METAL` and is counted
directly in current-wealth aggregation with no illiquidity caveats. This is a direct, minimal
extension of the `PRECIOUS_METAL` pattern established in 017-restructure-asset-types: one new enum
literal, one relaxed shared CHECK (`currentValue >= 0` instead of `> 0`), one new table-rebuild
migration, and the corresponding frontend form/labeling/chart entries.

## Technical Context

**Language/Version**: TypeScript (Node.js LTS runtime for the backend)

**Primary Dependencies**: NestJS (backend), Angular (frontend), Nx (monorepo tooling), `decimal.js`
(exact monetary values), `better-sqlite3` (embedded DB access) — all already in use, no new
dependency introduced by this feature.

**Storage**: SQLite, a single embedded file at `DATABASE_PATH`, accessed only from the backend
(Principle II, constitution's Stack Decision) — not PostgreSQL.

**Testing**: Jest (Nx default for both NestJS and Angular projects); domain-layer unit tests for
validation/merge changes, backend integration tests for the migration and API contract amendment,
per Principle IV.

**Target Platform**: Linux server (backend + bind-mounted SQLite file, Docker Compose), modern
evergreen browsers (Angular frontend).

**Project Type**: web-service + frontend, Nx monorepo (see Project Structure below).

**Performance Goals**: No new performance requirement — same request/response shape and volume as
the existing Holdings API; a single additional `AssetType` literal has no measurable cost.

**Constraints**: None beyond the existing Holdings API's — this feature adds no new endpoint, no
new external integration, and no new UI surface beyond one more option in an existing form/table/
chart.

**Scale/Scope**: One new `AssetType` literal, one relaxed CHECK constraint, one new migration step,
new API-contract request type, form/table/chart entries in the frontend — scoped entirely to the
existing Holdings feature area (`libs/domain/holdings`, `apps/backend/src/holdings`,
`apps/frontend/src/app/holdings`, `libs/api-contract`).

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- **I. Library-First**: PASS. All domain logic changes (asset-type metadata, validation floor,
  merge identity, `computeValue`) live in `libs/domain/holdings`, unchanged in principle from how
  `PRECIOUS_METAL` was added — no logic added to controllers/components.
- **II. API-First Interface**: PASS. The Holdings API contract is amended
  (`contracts/holdings-api-deposit-money.md`) before implementation; frontend consumes only the
  shared `libs/api-contract` types, no direct DB access.
- **III. Test Coverage**: PASS (planned, not yet executed). `currentValue >= 0` boundary (0 accepted,
  negative rejected) and the upsert-in-place behavior are exact-value-asserted financial-logic
  changes and MUST be covered by tests before this feature is done, per Principle III.
- **IV. Integration Testing**: PASS (planned). The `POST/PUT /holdings` contract amendment and the
  new migration step require integration tests exercising real request/response JSON and a real
  SQLite file, per Principle IV — not just in-memory domain objects.
- **V. Observability, Versioning & Simplicity**: PASS. Reuses the existing structured-logging call
  sites in `HoldingsService` unchanged (they already log `assetType`/`management` generically); the
  Holdings API contract version bumps `2.0.0 → 2.1.0` (additive); the design deliberately reuses the
  existing `PRECIOUS_METAL` mechanism rather than introducing a new one (YAGNI).
- **Product Scope**: PASS. Deposit money is manually entered only, no bank/brokerage API
  integration — consistent with the Out of Scope / manual-entry-only constraint.

No violations — Complexity Tracking is not needed.

## Project Structure

### Documentation (this feature)

```text
specs/018-deposit-money/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   └── holdings-api-deposit-money.md
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
apps/
├── backend/
│   └── src/
│       ├── database/
│       │   └── database.service.ts        # new migration step (widen CHECKs, add DEPOSIT_MONEY)
│       └── holdings/
│           ├── holdings.service.ts         # add DEPOSIT_MONEY to the upsert-lookup gate
│           ├── holdings.repository.ts      # no change (existing name-based branch already fits)
│           └── holdings.mapper.ts          # request/row mapping for the new create shape
└── frontend/
    └── src/app/
        ├── holdings/
        │   ├── asset-type-fields.ts        # ASSET_TYPES, field sets, label keys
        │   └── holding-form/
        │       └── holding-form.component.ts   # new form fields for DEPOSIT_MONEY
        ├── holdings/holdings-distribution/
        │   └── holdings-distribution.component.ts  # isNamedGroup for DEPOSIT_MONEY
        ├── shared/chart/
        │   └── chart-palette.ts            # ASSET_TYPE_COLORS entry
        └── core/i18n/translations/
            ├── en.ts                       # assetType.DEPOSIT_MONEY
            └── de.ts

libs/
├── domain/holdings/src/lib/
│   ├── asset-type.ts             # DEPOSIT_MONEY literal + field metadata
│   ├── holding.ts                # computeValue() branch
│   ├── holding-validation.ts     # currentValue floor 0 instead of >0; required-field rule
│   └── holding-merge.ts          # no change (existing non-ETF branch already covers it)
└── api-contract/src/lib/
    └── holdings.ts                # AssetType union + CreateDepositMoneyHoldingRequest
```

**Structure Decision**: No new Nx apps or libs. This feature extends the existing
`libs/domain/holdings`, `libs/api-contract`, `apps/backend/src/holdings` (+`database`), and
`apps/frontend/src/app/holdings` (+ shared chart/i18n) — the same project set
017-restructure-asset-types touched to add `PRECIOUS_METAL`'s current shape, since `DEPOSIT_MONEY`
is a strict subset of that same shape.

## Complexity Tracking

> No Constitution Check violations — this section is not applicable.
