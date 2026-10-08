# Implementation Plan: Holdings Rework

**Branch**: `045-holdings-rework` | **Date**: 2026-10-08 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/045-holdings-rework/spec.md`; UX in [design.md](./design.md) and [mockup.html](./mockup.html).

## Summary

Bring Holdings in line with the other domains and tighten its data model: encrypt every holding at rest
(single `payload_enc` blob, per-domain keyring, fail-closed 503), restrict ISIN to ETF/share, replace free-text
metal and crypto names with catalogue codes (4 metals, ~60 coins) defined once in `libs/domain/holdings`, store
metal quantity with a preserved unit (g / troy oz), allow 8-decimal crypto quantities, add a 500-char note,
drop the import (keep export), rework the form and the two dashboard tiles, and add holdings seeds. No data
migration: the old plaintext `holdings` table is dropped at boot and recreated in the final shape.

## Technical Context

**Language/Version**: TypeScript (Node.js LTS), Angular, NestJS, Nx monorepo (npm workspaces)

**Primary Dependencies**: existing only — better-sqlite3 via `DatabaseService`, decimal.js, PrimeNG, `DomainKeyringService`. No new dependency.

**Storage**: SQLite. `holdings` becomes `id, owner_id NOT NULL, payload_enc, key_version, created_at, updated_at` + owner index (AAD `holdings|<id>|<owner_id>`).

**Testing**: Jest (unit, backend e2e specs, frontend component specs), exact-value assertions (Principle III); Playwright via `verify-ui` for UI.

**Target Platform**: Linux server, evergreen browsers.

**Project Type**: web-service + frontend, Nx monorepo.

**Performance Goals**: n/a — a member holds tens of rows; list decrypts all rows of the owner per request (same as insurances).

**Constraints**: fail closed without keys; decimals as strings on the wire; ≤8 decimals crypto quantity; note ≤500 chars; validation identical client/server (shared lib).

**Scale/Scope**: 5 asset types, 4 metals, ~60 coins, 2 locales (de/en).

No NEEDS CLARIFICATION remain; see [research.md](./research.md).

## Constitution Check

_GATE: passed before research; re-checked after design (see end of table)._

| Principle / rule                                                                   | Status                                                                                                                  |
| ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| I Library-First                                                                    | Pass — catalogues, unit conversion, field definitions, validation live in `libs/domain/holdings` (framework-free).      |
| II API-First                                                                       | Pass — contract in `libs/api-contract`, OpenAPI + Bruno updated ([contracts/](./contracts/holdings-api.md)).            |
| III Test coverage, exact values                                                    | Pass — plan includes exact-value tests (31.1035 conversion, 0.00000001, 500-char note, ciphertext-only storage).        |
| IV Integration testing                                                             | Pass — backend e2e covers encrypted persistence, 503, merge, account deletion.                                          |
| V Simplicity / YAGNI                                                               | Pass — no migration, no new framework; merge by decrypting the owner's rows rather than adding plaintext index columns. |
| Sensitive Personal Data (encryption at rest, fail closed, owner-only, log hygiene) | **Amendment needed** — Holdings is not yet listed; see Complexity Tracking.                                             |
| Money/decimal                                                                      | Pass — strings on the wire, `Decimal` in domain, ciphertext as storage form.                                            |
| Frontend domain library rules                                                      | Pass — changes stay inside `libs/frontend/domain/holdings`, `shared-ui` (existing `app-empty-tile` reused).             |
| Out of scope: market prices                                                        | Pass — only stable ids stored for spec 046.                                                                             |
| In Scope: "bulk import via CSV or JSON"                                            | **Amendment needed** — import removed (FR-019).                                                                         |

Post-design re-check: same two amendments, no further violations.

## Project Structure

### Documentation (this feature)

```text
specs/045-holdings-rework/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/holdings-api.md
├── spec.md, design.md, mockup.html
└── tasks.md             # created by /speckit-tasks
```

### Source Code (repository root)

```text
libs/domain/holdings/src/lib/
├── metal-catalog.ts, crypto-catalog.ts, units.ts   # NEW: catalogues, oz constant, conversion
├── asset-type.ts, holding.ts, holding-validation.ts, holding-merge.ts   # reshaped (+specs)
libs/api-contract/src/lib/        holdings.ts, encryption.ts (+'holdings' domain id)
apps/backend/src/encryption/encryption.testing.ts   # encryption test helper (not under libs/api-contract)
libs/domain/holdings/package.json   # retagged scope:domain -> scope:shared (T002) so the frontend can import it
apps/backend/src/
├── holdings/        # + holdings-crypto.service, holdings-available.guard, holdings.exceptions; repo/mapper/service reworked
├── encryption/      # domain-encryption.registry.ts (+holdings)
├── database/        # holdings DDL; drop old table; remove migrateHoldingsAssetTypes
├── auth/users.repository.ts   # account deletion unchanged (still deletes holdings)
├── openapi/dto/holdings.ts, tests/holdings*.e2e-spec.ts
libs/frontend/domain/holdings/src/lib/   # form, table, tiles, export, unavailable component + guard; imports/ deleted
libs/frontend/shared-ui/src/lib/i18n/translations/   # holdings.de.ts / holdings.en.ts (+parity spec), encryption.* label
apps/frontend/src/app/   # app.routes (+spec): remove imports route; widget registry
api/openapi.yml, api/bruno/holdings/, docs (user guide en/de, README, testid-conventions)
tools/holdings/seed-holdings-testset.mjs + wiring in seed-lib/seed-all/seed-comprehensive/seed-realistic, tools/README.md
.specify/memory/constitution.md   # amendment 3.13.0
```

**Structure Decision**: extend existing libs only; no new Nx project. Catalogues sit in the domain lib (as `libs/insurances` catalog precedent) so UI and server validate against one list.

## Complexity Tracking

| Violation                                                                                                                                                                                        | Why Needed                                                                           | Simpler Alternative Rejected Because                                                                                   |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| Constitution amendment 3.13.0 (MINOR): remove "bulk import via CSV/JSON" from Holdings In Scope and the data-origin sentence; add Holdings to Sensitive Personal Data domains / encryption scope | Spec requires import removal and encryption; constitution currently contradicts both | Ignoring the contradiction would leave the constitution wrong; must be done in the same change with Sync Impact Report |
