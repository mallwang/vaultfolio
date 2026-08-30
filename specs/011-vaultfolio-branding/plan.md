# Implementation Plan: Vaultfolio Branding

**Branch**: `011-vaultfolio-branding` | **Date**: 2026-08-30 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/011-vaultfolio-branding/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Apply the Vaultfolio brand identity across the Angular frontend shell: a custom `TitleStrategy`
that composes "Vaultfolio - <Page>" browser tab titles from per-route `title` metadata already
added to `app.routes.ts`; the Vaultfolio logo as favicon, apple-touch-icon, and app-header mark
(replacing the old CSS-only sidebar brand mark/wordmark, which is removed so the brand is shown
once); and a PrimeNG Aura theme preset that swaps the default emerald primary palette for a teal
scale pinned to `teal.700` (the logo's icon color) so buttons/links/focus rings match. No backend,
API, or persisted-data changes are involved — this is presentation-layer only in `apps/frontend`.

## Technical Context

**Language/Version**: TypeScript (Angular 19+ frontend, per the existing `apps/frontend` project)

**Primary Dependencies**: Angular Router (`TitleStrategy` extension point), Angular
`platform-browser` `Title` service, PrimeNG `providePrimeNG` theming (`@primeuix/themes`,
`definePreset`) — all already dependencies of `apps/frontend`; no new packages required.

**Storage**: N/A — no persisted or backend data; this feature only touches static assets and
client-side presentation.

**Testing**: Vitest (Nx default for the `apps/frontend` project, confirmed by the existing
`title.strategy.spec.ts`); component/DOM-level assertions for header markup and asset references.

**Target Platform**: Modern evergreen browsers (Angular frontend), plus the browser tab/favicon
chrome and mobile "add to home screen" affordances.

**Project Type**: frontend-only change within the existing Nx monorepo (`apps/frontend`); no new
Nx project.

**Performance Goals**: N/A — static asset swap and a handful of DOM nodes; no measurable
performance target beyond "no regression to existing page load."

**Constraints**: Reuse the single existing `vaultfolio-logo.png` asset for all brand surfaces
(favicon, apple-touch-icon, header, README) rather than generating per-surface variants, per the
Assumptions in spec.md.

**Scale/Scope**: All routes in `app.routes.ts` (public + `/app/*` authenticated shell + the two
wildcard 404s) get a `title`; the app header, the sidebar (removal only), `index.html`, and the
root `README.md`.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- **I. Library-First**: N/A — no domain/finance logic is introduced; this is presentation-only
  wiring inside the existing `apps/frontend` app, not a new library boundary. PASS.
- **II. API-First Interface**: N/A — no backend or API surface touched. PASS.
- **III. Test-First (NON-NEGOTIABLE)**: Applies only to code touching financial data/calculations,
  which this feature does not. The one piece of non-trivial logic (`VaultfolioTitleStrategy`'s
  fallback/prefix behavior) already has a Vitest spec (`title.strategy.spec.ts`) covering both the
  prefixed and fallback cases. PASS.
- **IV. Integration Testing**: N/A — no new library contract, service boundary, or shared schema.
  PASS.
- **V. Observability, Versioning & Simplicity**: No new abstraction, service, or dependency is
  added — the theme preset reuses PrimeNG's existing `definePreset`/Aura mechanism, and the title
  strategy reuses Angular's existing `TitleStrategy` extension point. PASS.

No violations; Complexity Tracking is not needed.

## Project Structure

### Documentation (this feature)

```text
specs/011-vaultfolio-branding/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

No `contracts/` directory — this feature exposes no API, CLI, or other external interface; it is
UI presentation only.

### Source Code (repository root)

```text
apps/frontend/
├── public/
│   ├── favicon.ico                       # regenerated from vaultfolio-logo.png
│   └── vaultfolio-logo.png               # new: shared brand asset (header, touch icon)
├── src/
│   ├── index.html                        # <title>, favicon link, apple-touch-icon link
│   └── app/
│       ├── app.config.ts                 # VaultfolioPreset (definePreset), TitleStrategy provider
│       ├── app.routes.ts                 # per-route `title` metadata
│       ├── app.ts                        # drops the old static `title` field (now unused)
│       └── core/
│           ├── title.strategy.ts         # VaultfolioTitleStrategy (already implemented)
│           ├── title.strategy.spec.ts    # already implemented
│           └── layout/
│               ├── app-header/           # adds logo + wordmark markup/styles
│               └── app-sidebar/          # removes old brand mark/wordmark markup/styles

README.md                                 # adds centered logo image above the intro paragraph
```

**Structure Decision**: Everything lives inside the existing `apps/frontend` Angular app — no new
Nx app or lib. `core/title.strategy.ts` sits under the app's existing `core/` module (shared,
app-wide singletons/services), matching where `auth.interceptor` and similar cross-cutting
concerns already live. The header/sidebar changes stay within their existing component
directories under `core/layout/`. No shared/`libs/` code is touched since nothing here is
reused outside `apps/frontend`.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation                  | Why Needed         | Simpler Alternative Rejected Because |
| -------------------------- | ------------------ | ------------------------------------ |
| [e.g., 4th project]        | [current need]     | [why 3 projects insufficient]        |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient]  |
