# Implementation Plan: Unified Dashboard Tiles

**Branch**: `042-unified-dashboard-tiles` | **Date**: 2026-10-07 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/042-unified-dashboard-tiles/spec.md`; approved layout in [design.md](./design.md) / [mockup.html](./mockup.html)

## Summary

Give every Dashboard tile one shared frame — header, main content (common headline-amount size, fixed chart zone) and optional collapsible details — with a shared minimum height. Details are collapsed by default, expand per tile through a toggle, and the expanded state is remembered per user in the existing browser-local dashboard layout. Row neighbours stretch to the tallest tile via the existing grid but keep their details collapsed.

Approach: a new presentational `app-dashboard-tile` component (plus `app-tile-value`) in `shared-ui`; every domain widget switches its filled state to this frame and moves secondary content into the details slot. Expansion state is exposed to the frame through an optional injection token that the app's `DashboardLayoutStore` implements (research R3). Frontend-only: no API, database or domain-logic change.

## Technical Context

**Language/Version**: TypeScript, Angular (standalone components, signals)

**Primary Dependencies**: Angular, PrimeNG (`p-card` kept as outer card), existing `shared-ui` library; no new dependency

**Storage**: Browser `localStorage` only, via the existing per-user key of `DashboardLayoutStore` (`vaultfolio.dashboard-layout.<userId>`); layout JSON gains an optional `expanded: string[]`. No server storage.

**Testing**: Jest (Nx) unit/component tests per project; Playwright via the `verify-ui` skill for visual confirmation

**Target Platform**: Modern evergreen browsers, desktop and mobile widths

**Project Type**: Nx monorepo, frontend-only change (`libs/frontend/shared-ui`, `libs/frontend/domain/*` widgets, `apps/frontend` dashboard)

**Performance Goals**: No extra network requests; expanding/collapsing is a client-side toggle with no perceptible delay

**Constraints**: Domain libraries must not depend on the app (module boundaries); tile frame sizing/toggle logic must not be duplicated per widget (FR-015); all new texts in every supported language (FR-013); test ids per [testid-conventions](../../docs/frontend/testid-conventions.md) (FR-014)

**Scale/Scope**: 7 dashboard tiles across 6 domain widget libraries (holdings value, holdings distribution, earnings, retirement, insurances, wealth, account overview)

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle               | Assessment                                                                                                                                                                        |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I. Library-First        | Frame lives in `shared-ui` (existing library with a coherent UI-primitives purpose); no new library. No finance logic touched.                                                    |
| II. API-First           | No API change; expanded state is a purely local UI preference, no backend path bypassed.                                                                                          |
| III. Test Coverage      | No money/date logic changes. Component and store tests added for the frame, the layout parser and each migrated widget.                                                           |
| IV. Integration Testing | Shared-ui public contract changes (new component and token): covered by a Dashboard component test rendering real widgets inside the frame, plus a layout-store persistence test. |
| V. Simplicity           | One new presentational component, one tiny value component and one optional token. Justified in research R1/R3 against per-widget duplication and an app-owned toggle.            |
| Sensitive Personal Data | Frame displays the same data as before; the persisted expanded state holds tile ids only; nothing logged.                                                                         |

**Result**: Pass. Re-checked after design: unchanged.

## Project Structure

### Documentation (this feature)

```text
specs/042-unified-dashboard-tiles/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── design.md
├── mockup.html
├── contracts/
│   └── dashboard-tile-frame.md
└── tasks.md             # created by /speckit-tasks
```

### Source Code (repository root)

```text
libs/frontend/shared-ui/src/lib/
├── dashboard-tile/                 # NEW app-dashboard-tile (header, main, chart zone, details, toggle)
│   ├── dashboard-tile.component.ts
│   ├── dashboard-tile-expansion.token.ts
│   ├── tile-value.component.ts     # NEW app-tile-value (common headline-amount size)
│   └── *.spec.ts
├── empty-tile/                     # renders inside the same frame header/min-height
├── widget-header/                  # superseded by the frame header; removed once all widgets migrated
└── i18n/translations/{en,de}.ts    # toggle labels

libs/frontend/domain/*/src/lib/*dashboard-widget*/   # migrate filled states to the frame
libs/frontend/domain/holdings/src/lib/holdings-{total-value,distribution}/

apps/frontend/src/app/dashboard/
├── dashboard-layout.ts             # optional `expanded` list in layout + parser
├── dashboard-layout.store.ts       # provides the expansion token (isExpanded / setExpanded)
├── dashboard.component.{html,css,ts}  # card min-height, provides token, maintenance header
└── *.spec.ts
```

**Structure Decision**: Extend `shared-ui` (already holds `empty-tile`, `widget-header`, `maintenance`) with the frame; keep persistence in the app's existing `DashboardLayoutStore` and bridge it to the libraries through a token so libraries never import the app.

## Complexity Tracking

No constitution violations.
