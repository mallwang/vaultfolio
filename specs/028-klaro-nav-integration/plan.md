# Implementation Plan: Klaro Navigation Entry

**Branch**: `028-klaro-nav-integration` | **Date**: 2026-09-08 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/028-klaro-nav-integration/spec.md`

**Design**: [design.md](./design.md) — approved layout mockup for the nav entry and info page.

## Summary

Add a new "Klaro" entry to the existing app-shell side navigation (sidebar + mobile top bar),
positioned after Account Overview and before Settings, rendered with Klaro's own logo mark instead
of a Material Symbols glyph. Selecting it routes to a new, purely static/informational
`frontend-domain-klaro` page describing what Klaro is, linking out to
https://klaro.allwang.family/, and explaining the standalone-account and future-integration/
data-sync story. Klaro is registered as a domain in the existing `DOMAIN_REGISTRY` /
`isDomainEntitled` mechanism so it reuses the same per-domain entitlement/role gating as every
other domain (FR-010) — no new access-control logic, no backend changes, no new API surface.

## Technical Context

**Language/Version**: TypeScript (Node.js LTS runtime for the backend; unaffected by this feature)

**Primary Dependencies**: Angular (frontend), Nx (monorepo tooling), PrimeNG (`p-card`/`p-button`
consistent with other placeholder/info pages), `@vaultfolio/frontend-shared-ui`
(`IconComponent`/`TranslatePipe`), `@vaultfolio/frontend-domain-access` (`DOMAIN_REGISTRY`,
`isDomainEntitled`, `domainGuard`). No new runtime dependency is introduced.

**Storage**: N/A — this feature adds no persisted data (Principle II unaffected; purely
frontend-only per spec Assumptions).

**Testing**: Jest (Nx default for Angular projects) for the new component(s); no backend/API
surface exists to contract-test.

**Target Platform**: Modern evergreen browsers (Angular frontend); no backend/deployment impact.

**Project Type**: Nx monorepo — frontend-only change (new `scope:frontend-domain` library + shell
wiring). No backend or database changes.

**Performance Goals**: N/A — static informational page, no data fetching, no measurable
performance target beyond normal SPA route/lazy-chunk load.

**Constraints**: Klaro logo asset must be a locally bundled, static file (Constitution's icon rule
scopes Material Symbols to `app-icon`'s semantic glyph slot; the Klaro mark is a deliberate,
spec-mandated exception confined to this one nav item, not a change to the icon system). No
external network call is made by Vaultfolio itself to render the entry — the only outbound network
action is the user-initiated external link (FR-006).

**Scale/Scope**: One nav entry, one info page, one new Nx library, minor edits to
`application-areas.ts` / `DOMAIN_REGISTRY` / route table / i18n dictionaries. No new domain-scoped
backend module.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- **I. Library-First**: PASS. The Klaro info page is its own standalone
  `libs/frontend/domain/klaro` library (`scope:frontend-domain`), matching every existing domain
  (Holdings, Retirement, Insurances, Haushaltsplaner, Historic Wealth Development, Account
  Overview) — no logic is embedded ad hoc in the app-shell. There is no finance/domain
  calculation logic in this feature to isolate further.
- **II. API-First Interface**: PASS (N/A). The feature adds no backend capability and makes no
  direct DB/backend bypass — it is a static frontend page. FR-011 explicitly forbids exposing any
  real Klaro account data, so no API contract is needed.
- **III. Test Coverage**: PASS (N/A for money-handling — none exists here). Standard component
  tests are added per the project's usual Angular/Jest convention (spec files alongside each new
  component), consistent with how other placeholder domains are tested.
- **IV. Integration Testing**: PASS (N/A). No service boundary, shared schema, or serialization
  format is introduced — there is nothing to integration-test beyond the existing route/guard/nav
  filter composition, which is already covered by `app-sidebar`'s and `app.routes`'s existing
  specs and extended for the new entry.
- **V. Observability, Versioning & Simplicity**: PASS. No new logging need (no financial
  calculation, no import). The library follows the same versioning as every other frontend-domain
  library (`0.0.1`, matching siblings). Simplicity: reuses `DOMAIN_REGISTRY`/`isDomainEntitled`/
  `domainGuard`/`app-sidebar` filtering as-is — no new entitlement mechanism, no new nav-rendering
  branch beyond a small, scoped addition to render a logo image instead of a glyph for this one
  entry (see research.md #1).
- **Product Scope**: PASS. Klaro is a distinct product domain from Holdings/Haushaltsplaner/etc.;
  this feature only signposts it (per spec Assumptions, explicitly no account sync, no banking/
  brokerage integration, no budget-tracking logic) — nothing here conflicts with Product Scope's
  In/Out of Scope rules.
- **Frontend domain libraries Stack Decision**: PASS. New library lives at
  `libs/frontend/domain/klaro`, tagged `scope:frontend-domain`, depends only on `scope:shared`
  (`frontend-shared-ui`, `frontend-domain-access` types) — no dependency on another domain library
  or the app-shell, enforced by existing `@nx/enforce-module-boundaries` tags.

No violations — Complexity Tracking is not needed.

## Project Structure

### Documentation (this feature)

```text
specs/028-klaro-nav-integration/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (UI contract — no API)
├── design.md            # Already present (approved mockup, pre-plan)
├── mockup.html           # Already present
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
apps/frontend/src/app/core/layout/
├── application-areas.ts        # + one new APPLICATION_AREAS entry ('klaro'), + optional
│                                #   `logoAsset` field on ApplicationArea
└── app-sidebar/
    ├── app-sidebar.component.html   # render `<img>` when area.logoAsset is set, else <app-icon>
    └── app-sidebar.component.css    # sizing for the logo-mark slot, matching the icon slot

apps/frontend/src/app/app.routes.ts  # + 'klaro' route under domainGuard('klaro'), lazy-loading
                                      #   KlaroPageComponent from the new library

libs/frontend/domain-access/src/lib/
└── domain-registry.ts           # + Klaro DomainDescriptor entry (id: 'klaro') — reused by the
                                  #   admin accounts screen's domain-scopes multiselect

libs/frontend/domain/klaro/                 # NEW library, scope:frontend-domain
├── package.json
├── project.json
├── src/
│   ├── index.ts
│   └── lib/
│       └── klaro-page/
│           ├── klaro-page.component.ts
│           └── klaro-page.component.spec.ts
├── tsconfig.json
├── tsconfig.lib.json
└── tsconfig.spec.json

libs/frontend/shared-ui/src/lib/i18n/translations/
├── en.ts                        # + 'nav.klaro', 'pageTitle.klaro', 'klaroPage.*' keys
└── de.ts                        # + same keys, German copy

apps/frontend/public/ (or equivalent static-asset path used by existing logo/brand assets)
└── klaro-logo.svg                # NEW static asset — Klaro's brand mark (design.md's out-of-
                                   # scope placeholder swapped for the real asset during Phase 0
                                   # research, see research.md #2)
```

**Structure Decision**: One new Nx library, `libs/frontend/domain/klaro`
(`@vaultfolio/frontend-domain-klaro`, `scope:frontend-domain`), mirroring the existing
placeholder-domain libraries (e.g. `libs/frontend/domain/insurances`) exactly in shape —
`project.json`/`package.json`/`tsconfig*` boilerplate copied from a sibling, one page component
replacing the placeholder's empty-state card with the richer info-page layout from design.md. No
other new library is needed: the nav entry itself is a small, additive change to the existing
app-shell (`application-areas.ts`, `app-sidebar`) and domain-access (`domain-registry.ts`) files,
not a new shared library, since those files are explicitly designed as the single registration
point for exactly this kind of addition.

## Complexity Tracking

_No violations — table omitted._
