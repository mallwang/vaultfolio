# Implementation Plan: PrimeNG UI Foundation & Application Structure

**Branch**: `002-primeng-app-structure` | **Date**: 2026-08-28 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-primeng-app-structure/spec.md`

## Summary

Establish PrimeNG as the single shared UI component library for `apps/frontend`, apply its
default Aura theme globally, and introduce a persistent navigation shell (sidebar on
desktop/tablet, scrollable top bar on mobile) that routes between four top-level placeholder
areas — Dashboard, Holdings, Imports, Settings — plus an in-shell "not found" state. The existing
health-status screen relocates into Settings without functional change. Technical approach:
`primeng` + `@primeuix/themes` (Aura preset) + `primeicons`, wired via `providePrimeNG` in
`app.config.ts`; Angular Router for client-side routing; a small `core/layout/` scaffold plus one
folder per Application Area under `apps/frontend/src/app/`, documented in
`apps/frontend/README.md` per FR-008. No backend, database, or Nx lib changes.

## Technical Context

**Language/Version**: TypeScript (Angular ~22.0.4, per `apps/frontend`); no backend changes in
this feature.

**Primary Dependencies**: Angular (existing), Nx (monorepo tooling, existing) — plus this
feature's additions: `primeng@22.1.0`, `@primeuix/themes`, `primeicons` (see
[research.md](./research.md) §1–3).

**Storage**: None — no persisted data introduced (see [data-model.md](./data-model.md)).

**Testing**: Jest + Angular Testing Library conventions already used by `apps/frontend` (e.g.
`health-status.component.spec.ts`); no new contract/integration tests required (Principle IV
targets service/library contracts and shared schemas, not this UI-only shell).

**Target Platform**: Modern evergreen browsers (Angular frontend), responsive from common phone
widths through desktop (FR-009, SC-004).

**Project Type**: Frontend-only change within the existing Nx monorepo (`apps/frontend`); no
backend, database, or new Nx lib.

**Performance Goals**: SC-001 — area-to-area navigation completes in under 1 second on a typical
broadband connection (client-side route change, no network round trip required for placeholder
content).

**Constraints**: FR-009 — navigation shell MUST remain usable (no overlap/clipping) from common
phone width up through common desktop width. FR-010 — baseline keyboard navigability and
sufficient color contrast in the default (Aura) theme.

**Scale/Scope**: 4 top-level areas + 1 not-found state + 1 relocated existing screen
(health-status); no new backend endpoints.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle                                 | Applies? | Assessment                                                                                                                                                                                                              |
| ----------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I. Library-First                          | Partial  | No new domain/finance logic is introduced, so no new standalone Nx lib is required. This is presentation-only scaffolding inside the existing `apps/frontend` app (see [research.md](./research.md) §6) — no violation. |
| II. API-First Interface                   | No       | No backend/API changes; frontend continues calling the existing health-status endpoint through the existing API client, unchanged.                                                                                      |
| III. Test-First (NON-NEGOTIABLE)          | N/A      | No money/financial-calculation code touched — this gate applies to financial data/calculations, which this UI-shell feature doesn't include.                                                                            |
| IV. Integration Testing                   | No       | No new library public contract, no contract change, no shared schema — this feature is UI routing/layout only.                                                                                                          |
| V. Observability, Versioning & Simplicity | Yes      | Simplicity: reuses PrimeNG's default Aura preset and Angular Router rather than custom theming/routing (research.md §2, §5); no new Nx lib added until one is actually needed (YAGNI, research.md §6, §4).              |

**Result**: PASS — no violations requiring Complexity Tracking justification.

## Project Structure

### Documentation (this feature)

```text
specs/002-primeng-app-structure/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output
├── data-model.md         # Phase 1 output
├── quickstart.md         # Phase 1 output
├── contracts/
│   └── application-areas.md  # Phase 1 output — area-registration convention (FR-008)
├── design.md              # Approved UX mockup (from /speckit-ux-review)
└── tasks.md              # Phase 2 output (/speckit-tasks — not created by /speckit-plan)
```

### Source Code (repository root)

```text
apps/frontend/src/app/
├── app.config.ts               # + providePrimeNG({ theme: { preset: Aura } }), provideRouter
├── app.routes.ts                # NEW — route table: dashboard/holdings/imports/settings + '**'
├── app.ts / app.html             # simplified to host <router-outlet> inside the shell
├── core/
│   └── layout/
│       ├── app-shell/            # NEW — top-level shell composing sidebar + header + outlet
│       ├── app-sidebar/          # NEW — desktop sidebar + mobile scrollable top-bar nav
│       ├── app-header/           # NEW — crumb/title + user-identity placeholder
│       ├── not-found/            # NEW — in-shell "not found" state (FR-006)
│       └── application-areas.ts  # NEW — APPLICATION_AREAS list (id/label/path/icon), the
│                                  #        single source of truth nav + routing both read
│                                  #        (contracts/application-areas.md)
├── dashboard/                    # NEW — placeholder: stat-card shells + empty state
├── holdings/                     # NEW — placeholder: table shell + empty state
├── imports/                      # NEW — placeholder: dropzone-style empty state
├── settings/                     # NEW — hosts relocated health-status + "Preferences" placeholder
│   └── health-status/            # MOVED from apps/frontend/src/app/health-status/ (FR-007)
└── styles.css                    # + PrimeIcons import if not covered by theme

apps/frontend/README.md           # NEW or extended — documents layout/theming/area conventions
                                    # (FR-008), linking contracts/application-areas.md's steps

package.json                      # + primeng, @primeuix/themes, primeicons (apps/frontend deps)
```

**Structure Decision**: Everything lives inside the existing `apps/frontend` Nx application — no
new Nx lib. `core/layout/` holds the shell (not tied to any one Application Area); each area gets
its own top-level folder under `app/` so the pattern SC-003 asks a new contributor to follow is
literally "copy an existing area folder + add one router entry + one `APPLICATION_AREAS` entry"
(see [contracts/application-areas.md](./contracts/application-areas.md)). `health-status/` moves
under `settings/` since it's now Settings' "System health" section (design.md) rather than a
standalone route.

## Complexity Tracking

_No Constitution Check violations — this section is intentionally empty._
