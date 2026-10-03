# Implementation Plan: Export Modal Dialog

**Branch**: `036-export-modal-dialog` | **Date**: 2026-10-03 | **Spec**: [spec.md](spec.md) | **Design**: [design.md](design.md)

**Input**: Feature specification from `/specs/036-export-modal-dialog/spec.md`

## Summary

Replace the PrimeNG split button of the shared `<app-export-control>` with a primary-colored text link
"Daten exportieren" that opens a PrimeNG dialog with one card per format (PDF, Excel, CSV, JSON).
Each card shows a static CSS preview, the real download file name, the format, the included data
(generic text, overridable per feature through the export definition) and "best / less suited for"
hints, plus its own export button. Exports of different cards run independently, the dialog stays
open, and a failure shows an in-dialog banner. The export generation (`exportFeature`, exporters)
is untouched; only two pure file-name helpers move into `libs/export` so the file name shown on the
card and the downloaded file come from one function. Frontend-only, no API or database change.

## Technical Context

**Language/Version**: TypeScript (Angular, standalone components, signals)

**Primary Dependencies**: Angular, PrimeNG (`p-dialog`, `pTooltip`), Nx, existing `@vaultfolio/export`; no new dependency

**Storage**: none (no persistence, no backend change)

**Testing**: Vitest (`@angular/build:unit-test`) component specs in the frontend libs, Jest for `libs/export` unit specs; Playwright throw-away verification via the `verify-ui` skill

**Target Platform**: modern evergreen browsers, desktop and 360–400 px mobile

**Project Type**: Nx monorepo, frontend-only change (`libs/frontend/shared-ui`, `libs/export`, 7 domain call sites)

**Performance Goals**: dialog opens instantly, no data fetch or chart capture on open (SC-006)

**Constraints**: file name on a card equals the downloaded file name (FR-004); exported file content byte-identical to today (FR-012); all texts in de + en (FR-013)

**Scale/Scope**: 1 shared component rework, 1 new dialog component, 7 call sites, ~35 i18n keys × 2 languages

## Constitution Check

_GATE: passed before Phase 0, re-checked after Phase 1._

| Principle / rule             | Assessment                                                                                                                             |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| I. Library-First             | File-name derivation lives in framework-independent `libs/export` (pure functions, unit-tested); UI stays in `shared-ui`. PASS         |
| II. API-First                | No backend capability touched. N/A                                                                                                     |
| III. Test Coverage           | Component, helper and per-feature-override specs planned; no monetary logic changed. PASS                                              |
| IV. Integration Testing      | Dialog spec drives the real `exportFeature` (as the existing control spec does) and asserts the real downloaded file name. PASS        |
| V. Simplicity                | No new library or dependency; reuses `p-dialog` pattern of the Earnings privacy dialog; no export-all, no persistence of choices. PASS |
| Sensitive Personal Data      | Previews are static and show invented values only; no new data leaves the device; Earnings export content unchanged. PASS              |
| Stack / Frontend domain libs | Control stays in `shared-ui`; domains only change one tag and optionally add override keys to their definition. PASS                   |

No violations, Complexity Tracking not needed.

## Project Structure

### Documentation (this feature)

```text
specs/036-export-modal-dialog/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── design.md / mockup.html
├── contracts/export-dialog.md
└── tasks.md            # /speckit-tasks
```

### Source Code (repository root)

```text
libs/export/src/lib/
├── export-file-name.ts            # NEW: exportFileExtensionFor(), sanitizeExportFileName(), exportFileName()
├── export-file-name.spec.ts       # NEW
├── export-feature.ts              # exportFileExtension() delegates to the new helper
└── feature-export-definition.ts   # + optional formatDataKeys

libs/frontend/shared-ui/src/lib/export-control/
├── export-control.component.ts    # REWORK: link + dialog host (no split button, no `severity` input)
├── export-dialog.component.ts     # NEW: p-dialog with the four cards, per-format busy, error banner
├── export-format-preview.component.ts  # NEW: static CSS preview per format
├── export-format-catalog.ts       # NEW: format order, icons, i18n keys
├── feature-export-runner.ts       # NEW: injectable; former export() body, returns the file name
└── *.spec.ts                      # specs for each

libs/frontend/shared-ui/src/lib/i18n/translations/{de,en}.ts   # export.* keys

libs/frontend/domain/earnings/src/lib/earnings-export.definition.ts  # formatDataKeys override (+ earnings.de/en keys)
libs/frontend/domain/*/…  (7 call sites)   # drop severity="info"
docs/user-guide.md, docs/user-guide.de.md  # export sections
```

**Structure Decision**: Extend `shared-ui`'s existing export-control folder; no new Nx project. The
export body moves unchanged into an injectable runner so the link component, dialog and specs share
one implementation, and so per-format concurrent runs do not share state.

## Phase 0/1 artifacts

[research.md](research.md), [data-model.md](data-model.md), [contracts/export-dialog.md](contracts/export-dialog.md), [quickstart.md](quickstart.md).
