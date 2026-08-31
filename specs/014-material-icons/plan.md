# Implementation Plan: Material Icons as Default Icon Library

**Branch**: `014-material-icons` | **Date**: 2026-08-31 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/014-material-icons/spec.md`

## Summary

Replace PrimeIcons (the `pi pi-*` icon font, v8.0.0) with Google Material Symbols everywhere in
the Angular frontend, following the icon-swap pattern PrimeNG documents at
https://primeng.dev/customicons. The change is purely presentational: a new
`vf-icon` wrapper component renders Material Symbols glyphs from a semantic icon name, all ~30
distinct `pi-*` usages across ~25 template/component files are converted to it, and every PrimeNG
component whose internals render a hardcoded PrimeIcon (dialog close, dropdown/select trigger,
table sort arrows, datepicker trigger, confirm-dialog icons, toast icons) is given an
icon-slot `ng-template` override that renders `vf-icon` instead. `primeicons` is removed from
`styles.css` and `package.json` once no reference remains. The constitution already records this
decision (Stack Decision → Icon library, v3.1.0); no further constitution change is needed by this
plan.

## Technical Context

**Language/Version**: TypeScript, Angular ~22.1.0 (frontend only — no backend change)

**Primary Dependencies**: PrimeNG ~22.1.0 (existing UI kit, kept), Google Material Symbols web font
(new — loaded the same way the existing Inter font is, via `<link>` in `index.html`); `primeicons`
(^8.0.0) is removed once the swap is complete.

**Storage**: N/A — no data model change (UI presentation only)

**Testing**: Jest + Angular Testing Library conventions already used in `apps/frontend`; component
tests for the new `vf-icon` component (name→glyph resolution, fallback-on-unknown-name behavior);
no backend/integration tests needed since no contract changes.

**Target Platform**: Modern evergreen browsers (Angular frontend), same as today.

**Project Type**: Frontend-only change within the existing Nx monorepo (`apps/frontend`); no new
Nx app or library.

**Performance Goals**: No regression vs. today — Material Symbols is loaded as a single variable
web font (comparable to the existing PrimeIcons icon font), not one HTTP request per icon.

**Constraints**: Must not leave any `pi pi-*` class or `primeicons` import anywhere in
`apps/frontend` (FR-002); unknown/unmapped icon names must fail visibly, not silently (FR-007);
icons must remain theme/color/size responsive and accessible (FR-004, FR-008).

**Scale/Scope**: ~30 distinct icon names in use today, across ~25 HTML/TS files, plus 6 PrimeNG
components (`p-dialog`, `p-select`, `p-datepicker`, `p-table`, `p-confirmdialog`, `p-toast`) whose
built-in icon slots need explicit overrides. No new screens or routes.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- **Principle I (Library-First)**: PASS. The new `vf-icon` component is a shared UI presentation
  component, not domain/finance logic — Principle I's library-isolation requirement targets
  finance/domain code specifically. It lives in `apps/frontend/src/app/shared/icon/`, consistent
  with the app's existing shared-component layout; no new Nx library is warranted (single
  consuming app, YAGNI per Principle V).
- **Principle II (API-First Interface)**: PASS / N/A. No API contract is touched.
- **Principle III (Test Coverage)**: PASS. No monetary/financial logic is touched; the
  icon-name→glyph mapping and fallback behavior get ordinary component tests.
- **Principle IV (Integration Testing)**: PASS / N/A. No cross-service or shared-schema
  communication is introduced.
- **Principle V (Observability, Versioning & Simplicity)**: PASS. Uses the simplest mechanism
  available (one wrapper component + PrimeNG's documented icon-template overrides) rather than a
  custom icon-font pipeline; unknown-icon fallback is a deliberate, visible signal per FR-007
  rather than a silent gap.
- **Stack Decision — Icon library (v3.1.0)**: PASS by construction — this feature implements that
  exact constraint (Material Icons via PrimeNG's documented custom-icon mechanism, PrimeIcons
  removed). No further constitution amendment is required.

No violations — Complexity Tracking section is not needed.

## Project Structure

### Documentation (this feature)

```text
specs/014-material-icons/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output
├── data-model.md         # Phase 1 output (no new entities — icon name/glyph mapping documented here)
├── quickstart.md        # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

No `contracts/` directory: this feature exposes no new API, CLI, or cross-service interface — it
is a frontend-internal presentation change (Phase 1, step 2 is skipped for that reason).

### Source Code (repository root)

```text
apps/frontend/src/app/
├── shared/
│   └── icon/
│       ├── icon.component.ts       # <vf-icon name="..."> — renders a Material Symbols glyph
│       ├── icon.component.html
│       ├── icon.component.spec.ts  # name→glyph resolution + unknown-name fallback tests
│       └── icon-name.map.ts        # PrimeIcons name -> Material Symbols name lookup (migration aid)
├── <existing feature folders>/     # ~25 files with pi-* usages updated to <vf-icon>
└── app.config.ts                   # PrimeNG icon-slot templates registered/overridden here or
                                     # per-component, per research.md's decision

apps/frontend/src/
├── index.html            # add Material Symbols <link>, same pattern as the existing Inter font
└── styles.css             # remove `@import 'primeicons/primeicons.css'`
```

**Structure Decision**: All changes stay inside the existing `apps/frontend` Nx project. No new Nx
app or library is created — this is a single-app, presentation-only change (see Constitution Check
above for the Library-First reasoning). `package.json`'s `primeicons` dependency is removed as part
of this feature once the last `pi-*` reference is gone.
