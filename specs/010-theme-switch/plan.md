# Implementation Plan: Light/Dark Theme Switch

**Branch**: `010-theme-switch` | **Date**: 2026-08-30 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/010-theme-switch/spec.md`

**Design**: [design.md](./design.md) — approved mockup: icon-only sun/moon toggle next to sign-out.

## Summary

Add a client-side, per-browser light/dark theme switch to Vaultfolio: an icon-only toggle button
in the always-on root header (`AppHeaderComponent`), visible to authenticated and unauthenticated
visitors alike. A new `ThemeService` resolves the initial theme (explicit choice from
`localStorage`, else `prefers-color-scheme`, else light), toggles PrimeNG's dark-mode CSS selector
class on `<html>` for an instant, no-reload visual change, and persists explicit choices back to
`localStorage`. No backend or database involvement — this is purely a frontend concern.

## Technical Context

**Language/Version**: TypeScript, Angular ~22.1 (frontend only — no backend changes)

**Primary Dependencies**: Angular (signals, `DOCUMENT`/`Renderer2`), PrimeNG ^22.1 (`providePrimeNG`
dark-mode selector, `p-button` icon toggle), no new dependencies

**Storage**: Browser `localStorage` only (key holding `'light' | 'dark'`); no PostgreSQL/SQLite
involvement — theme preference is explicitly per-browser and not an account setting (spec
Assumptions)

**Testing**: Jest + Angular Testing Library conventions already used under
`apps/frontend/src/app/**/*.spec.ts`; unit tests for `ThemeService` (resolution/persistence logic)
and component tests for the toggle button's rendered state/`aria-*` attributes

**Target Platform**: Modern evergreen browsers (Angular frontend), no backend/platform change

**Project Type**: Frontend-only change within the existing Nx monorepo (`apps/frontend`)

**Performance Goals**: Theme switch visually completes in under 1 second (SC-001) — in practice a
synchronous CSS class toggle, effectively instant

**Constraints**: No full page reload on toggle (FR-004); must not regress existing PrimeNG Aura
light theme already wired in `app.config.ts`

**Scale/Scope**: One new lightweight Angular service + one small template/CSS change to
`AppHeaderComponent`; no new routes, no new Nx projects, no API contract changes

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- **I. Library-First**: N/A in the "standalone library" sense — this feature has no finance/domain
  logic (it touches no holdings, valuations, or money values). Precedent in this codebase
  (`core/layout/*`, `auth/*`) is to keep app-shell/UI-chrome concerns as plain Angular
  services/components under `apps/frontend/src/app/core/`, not extracted into an Nx lib. Per
  Principle V (YAGNI), a dedicated Nx lib for a single toggle-state service would be an
  unjustified abstraction. **PASS** (no violation to track).
- **II. API-First Interface**: No backend/API involvement — theme state never crosses the network
  or touches the API contract. **PASS** (not applicable).
- **III. Test-First**: No money/date/financial calculation touched. Test-first is still followed as
  standard practice (tests for `ThemeService` and the toggle button written alongside/before
  implementation) but the NON-NEGOTIABLE clause's exact-value-assertion requirement is not
  triggered. **PASS**.
- **IV. Integration Testing**: No new library public contract, no service-to-service communication,
  no shared schema. Component-level tests covering the header's rendered toggle across
  authenticated/unauthenticated states are sufficient. **PASS** (not applicable).
- **V. Observability, Versioning & Simplicity**: Implementation stays minimal — one service, one
  template change, `localStorage` for persistence, PrimeNG's existing dark-mode selector
  mechanism (no new theming library, no new state-management dependency). **PASS**.

No Complexity Tracking entries required — no violations.

## Project Structure

### Documentation (this feature)

```text
specs/010-theme-switch/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md         # Phase 1 output (/speckit-plan command)
├── quickstart.md         # Phase 1 output (/speckit-plan command)
├── contracts/            # Phase 1 output (/speckit-plan command)
├── design.md              # (existing) approved mockup notes
├── mockup.html            # (existing) approved mockup
└── tasks.md               # Phase 2 output (/speckit-tasks command — NOT created here)
```

### Source Code (repository root)

```text
apps/frontend/src/app/
├── core/
│   ├── theme/                          # NEW — theme service + tests
│   │   ├── theme.service.ts
│   │   └── theme.service.spec.ts
│   └── layout/
│       └── app-header/
│           ├── app-header.component.ts     # MODIFIED — inject ThemeService, toggle handler
│           ├── app-header.component.html   # MODIFIED — add icon-only toggle button
│           ├── app-header.component.css    # MODIFIED — position toggle in the meta cluster
│           └── app-header.component.spec.ts  # MODIFIED — cover both auth states
└── app.config.ts                        # MODIFIED — configure PrimeNG dark-mode selector
```

**Structure Decision**: Everything lives inside the existing `apps/frontend` Nx project — no new
Nx app or lib. `ThemeService` is added as a new `core/theme/` module alongside the existing
`core/layout/` pattern (app-shell chrome/cross-cutting concerns, not a feature area). This matches
how `auth/current-user.store.ts` is already handled: a small, app-wide singleton service under
`core`/feature root rather than a standalone library, since it holds no domain/finance logic and
has no reuse target outside this one Angular app.

## Complexity Tracking

_No violations — table intentionally omitted._
