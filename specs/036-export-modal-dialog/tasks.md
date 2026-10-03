# Tasks: Export Modal Dialog

**Input**: Design documents from `/specs/036-export-modal-dialog/`
**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [design.md](design.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/export-dialog.md](contracts/export-dialog.md), [quickstart.md](quickstart.md)

**Tests**: Included (constitution Principle III/IV require coverage; existing specs for the control are rewritten).

**Format**: `- [ ] T### [P?] [US?] Description with file path` — `[P]` = different files, no dependency on an incomplete task.

Paths: `EXP` = `libs/export/src/lib`, `SUI` = `libs/frontend/shared-ui/src/lib`, `EC` = `libs/frontend/shared-ui/src/lib/export-control`, `TR` = `libs/frontend/shared-ui/src/lib/i18n/translations`.

## Phase 1: Setup

- [x] T001 Confirm green baseline: run `npx nx run-many -t test -p @vaultfolio/export @vaultfolio/frontend-shared-ui @vaultfolio/frontend-domain-earnings` and note existing export-control spec cases that will be rewritten.

## Phase 2: Foundational (blocks all stories)

- [x] T002 [P] Create pure file-name helpers `exportFileExtensionFor`, `sanitizeExportFileName`, `exportFileName` in `EXP/export-file-name.ts`; make `exportFileExtension` in `EXP/export-feature.ts` delegate to it; export all from `libs/export/src/index.ts`.
- [x] T003 [P] Add `EXP/export-file-name.spec.ts` (Jest): zip only for csv+tables, other formats keep their extension, sanitization of `/ \ : * ? " < > |`, unchanged behavior of `exportFileExtension`.
- [x] T004 [P] Add optional `formatDataKeys?: Partial<Record<ExportFormat, string>>` with doc comment to `FeatureExportDefinition` in `EXP/feature-export-definition.ts`.
- [x] T005 [P] Add `export.link`, `export.dialog.*` (title, hint, close, error, preview, labels, per-format name/intro/type/data/goodFor/lessSuited/button, `csv.typeZip`) to `TR/de.ts`; remove unused `export.buttonLabel` and `format*Description` keys only if no other usage remains (grep first).
- [x] T006 [P] Add the same keys in English to `TR/en.ts` (key-parity spec must stay green).
- [x] T007 [P] Create `EC/export-format-catalog.ts`: fixed order pdf, xlsx, csv, json with icon and i18n key names per `data-model.md`.
- [x] T008 Create injectable `FeatureExportRunner` in `EC/feature-export-runner.ts`: move the body of `ExportControlComponent.export()` unchanged (fetch, resolve, `exportFeature`), use `exportFileName` for the download name, return the file name; move `triggerDownload` along. Depends on T002.
- [x] T009 [P] Add `EC/feature-export-runner.spec.ts`: moved/adapted cases from the old control spec (pdf sections, tables, chart capture, file name per format, empty data, unknown feature id).

**Checkpoint**: helpers, keys, catalog, runner ready.

## Phase 3: User Story 1 — Choose and download a format from an overview (P1) 🎯 MVP

**Goal**: Link replaces the split button; dialog shows four explained cards; a card button downloads exactly that format with the displayed name.

**Independent Test**: On Holdings click "Daten exportieren", see four cards, press Excel → `Bestände.xlsx` downloads.

- [x] T010 [P] [US1] Create `EC/export-format-preview.component.ts`: static, `aria-hidden`, dimmed CSS mock per format (page+bars+mini chart, spreadsheet grid, CSV text, JSON code), invented values, inline template/styles (per the library's existing convention).
- [x] T011 [US1] Create `EC/export-dialog.component.ts`: `p-dialog` (modal, dismissable mask, breakpoints, close `pt` test id), `featureId` input + `visible` model, cards from the catalog with preview, file name (`exportFileName` with `Boolean(definition.getExportTables)`), type, data text (`formatDataKeys` fallback to generic), goodFor/lessSuited, per-card button calling `FeatureExportRunner`; 2-column grid, 1 column ≤ 640 px; test ids per contract (`export-dialog`, `export-dialog-close`, `export-card-<f>`, `export-btn-<f>`, `export-filename-<f>`). No export-all.
- [x] T012 [US1] Rework `EC/export-control.component.ts`: remove `SplitButtonModule`, `FORMAT_MENU`, menu/`onDefaultAction`, `severity` input and `export()`; render a text-link `<button>` (icon + `export.link`, `--p-primary-color`, hover underline, visible focus) with `data-testid="export-open-link"` that opens the dialog.
- [x] T013 [US1] Remove `.export-menu-item` styles from `apps/frontend/src/styles.css`.
- [x] T014 [P] [US1] Drop `severity="info"` at the 7 call sites: `libs/frontend/domain/{holdings,account-overview,earnings,retirement,insurances,haushaltsplaner,historic-wealth-development}` (components containing `<app-export-control`).
- [x] T015 [P] [US1] Rewrite `EC/export-control.component.spec.ts` and add `EC/export-dialog.component.spec.ts` (Vitest): link opens dialog, four cards in order, no export-all, card shows the real file name and exporting PDF/CSV/XLSX/JSON triggers a download with exactly that name (real `exportFeature`), de + en texts.
- [x] T016 [P] [US1] Add `EC/export-format-preview.component.spec.ts` (renders per format, `aria-hidden`, no data access).
- [x] T017 [US1] Verify in the running app with the `verify-ui` skill (Holdings, desktop + 400 px, light + dark): link replaces split button, dialog layout matches [mockup.html](mockup.html), downloads named as shown.

**Checkpoint**: MVP complete and demonstrable.

## Phase 4: User Story 2 — Export several formats in one visit (P2)

**Goal**: Dialog stays open; busy state per card only; downloads survive closing.

**Independent Test**: Export PDF then Excel without closing; during a PDF run only its button is busy.

- [x] T018 [US2] In `EC/export-dialog.component.ts` add `busyFormats` signal: set/unset around each run (`finally`), disable only that card's button with `aria-busy` and spinner label "Wird erstellt …"; guard against double trigger; dialog stays open after success.
- [x] T019 [P] [US2] Extend `EC/export-dialog.component.spec.ts`: two sequential exports keep the dialog open; during a pending PDF only the PDF button is disabled/busy and CSV still works; closing the dialog does not abort the running export.
- [x] T020 [US2] `verify-ui`: export two formats in one session on Holdings, confirm both downloads and the busy state.

## Phase 5: User Story 3 — Feature-specific "included data" (P2)

**Goal**: Earnings shows ZIP with four CSV files; other features show a single `.csv`.

**Independent Test**: Earnings CSV card → `Einkommensentwicklung.zip` and "4 CSV-Dateien"; Holdings → `Bestände.csv`.

- [x] T021 [P] [US3] Add `earnings.export.data.{pdf,xlsx,csv,json}` texts to `TR/earnings.de.ts` and `TR/earnings.en.ts`.
- [x] T022 [US3] Set `formatDataKeys` in `libs/frontend/domain/earnings/src/lib/earnings-export.definition.ts`.
- [x] T023 [P] [US3] Extend `libs/frontend/domain/earnings/src/lib/earnings-export.definition.spec.ts`: `formatDataKeys` covers all four formats, `getExportTables()` returns exactly four tables (guards the "4 CSV files" text), `earnings-translations.spec.ts` stays green.
- [x] T024 [P] [US3] Extend `EC/export-dialog.component.spec.ts`: definition with `getExportTables` → CSV card shows `.zip` and zip type text; without → `.csv`; override text is shown, other formats fall back to generic.
- [x] T025 [US3] `verify-ui`: Earnings CSV card shows `.zip`, downloaded file name matches; Holdings CSV shows `.csv`.

## Phase 6: User Story 4 — Unavailable and failed export (P3)

**Goal**: Disabled link with tooltip and no dialog; in-dialog error banner on failure.

**Independent Test**: Retirement link disabled + tooltip; forced failure shows banner and keeps cards usable.

- [x] T026 [US4] In `EC/export-control.component.ts` add disabled state from `definition.isEnabled()` with tooltip wrapper showing `disabledTooltipKey`; guard `visible` so the dialog never opens when disabled.
- [x] T027 [US4] In `EC/export-dialog.component.ts` add `errorFormat` signal and `role="alert"` banner (`data-testid="export-dialog-error"`, names the format), cleared on next export and on reopen; if the dialog is closed when the failure happens, show an app-wide `MessageService` toast instead.
- [x] T028 [P] [US4] Extend specs: disabled link has `disabled`, tooltip text, click does not open; rejected export shows banner and re-enables the button; closed-dialog failure triggers the toast.
- [x] T029 [US4] `verify-ui`: Retirement/Insurances disabled state; failure banner (e.g. via route interception).

## Phase 7: Polish & Cross-Cutting

- [x] T030 [P] Accessibility check: keyboard open/close, focus returns to the link, accessible names per card button (`Als <Format> exportieren`), contrast in dark theme (`verify-ui`).
- [x] T031 [P] Update `docs/user-guide.md` and `docs/user-guide.de.md` (sections mentioning the Export split button for Holdings, Account Overview, Earnings) to describe the link and dialog.
- [x] T032 Run `npx nx run-many -t lint,test,build -p @vaultfolio/export @vaultfolio/frontend-shared-ui @vaultfolio/frontend-domain-earnings @vaultfolio/frontend-domain-holdings frontend` and fix findings; run `quickstart.md` validation.
- [ ] T033 Run `/speckit-sonar-validate` / local Sonar for the changed files and resolve new issues.

## Dependencies & Order

- Phase 1 → Phase 2 → US1 (MVP). US2, US3, US4 each depend only on US1 and on Phase 2; US2/US3/US4 touch the same dialog file (T018, T027, T011), so implement them sequentially, not in parallel.
- Within Phase 2: T002 before T008; T003, T004–T007, T009 are parallel.
- Within US1: T010 before T011 before T012; T014–T016 parallel after T012.

## Parallel Examples

- Phase 2: T002 ∥ T004 ∥ T005 ∥ T006 ∥ T007.
- US1: T010 ∥ T014 (different files) while T011/T012 proceed sequentially.
- US3: T021 ∥ T023 ∥ T024.

## Implementation Strategy

1. Foundational (Phase 2), then US1 as MVP: replaces the split button everywhere with correct downloads — demoable alone.
2. Add US2 (busy handling), US3 (Earnings text), US4 (disabled/error) incrementally; each ends with a `verify-ui` check.
3. Finish with docs, full lint/test/build and Sonar.
