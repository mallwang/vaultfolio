# Research: Export Modal Dialog

## R1 — How is the file name derived without fetching data?

**Decision**: Add pure helpers to `libs/export`: `exportFileExtensionFor(format, hasTables)` (zip only for `csv` + tables), `sanitizeExportFileName(title)` (the existing `[/\\:*?"<>|]` → `_` rule) and `exportFileName(title, format, hasTables)`. `hasTables` is `Boolean(definition.getExportTables)`. The runner uses the same function for the download, the dialog for the card.

**Rationale**: Today the extension depends on `resolved.tables`, which exists only after the fetch; but `tables` is set exactly when `definition.getExportTables` exists and `format !== 'pdf'`, so the presence of the method decides it (FR-004, SC-003 by construction). Sharing one function removes any drift.

**Alternatives**: duplicate the logic in the dialog (drift risk); fetch on open (violates FR-006/SC-006).

## R2 — Per-feature "included data" text

**Decision**: Generic i18n per format (`export.dialog.<format>.data`), plus optional `formatDataKeys?: Partial<Record<ExportFormat, string>>` on `FeatureExportDefinition`. Earnings supplies keys for all four formats; others use defaults. The "4 CSV files" count in the Earnings text is guarded by a spec asserting `getExportTables()` returns exactly four tables.

**Rationale**: Matches the chosen "generic + optional override" decision; the definition already carries translation keys, so the framework-free library stays unchanged in nature.

**Alternatives**: text fully per feature (maintenance for 7 features); computing the count from the tables (requires data fetch).

## R3 — Dialog primitive and structure

**Decision**: PrimeNG `p-dialog` (modal, dismissable mask, breakpoint for mobile) exactly like `PrivacyDialogComponent`; content is a responsive CSS grid (2 columns, 1 below ~640 px). Close icon via `app-icon`, close button gets a test id through `pt`, same as the existing dialog.

**Rationale**: Gives focus trap, Esc, focus return and `aria-modal` for free (FR-014); consistent look. `ExportControlComponent` keeps the `app-export-control` selector and `featureId` input so call sites change by one attribute.

**Alternatives**: custom overlay (a11y burden); new `ExportDialogService` opened programmatically (more machinery than one inline component).

## R4 — Concurrency and busy state

**Decision**: Busy state is a `Set<ExportFormat>` signal in the dialog; each card's button is disabled only for its own format. The runner is stateless per call. Closing the dialog does not cancel (the promise continues, the runner lives on the root-provided injector).

**Rationale**: Spec requires other cards stay usable and downloads complete after close. Only the PDF captures chart images (offscreen), so parallel runs do not collide.

**Alternatives**: global busy flag (blocks other cards, contradicts Story 2).

## R5 — Error reporting

**Decision**: An in-dialog banner (`role="alert"`, text names the format) as approved in the mockup; cleared when another export starts or the dialog reopens. If the dialog was closed before the failure, fall back to the app-wide `MessageService` toast (existing pattern).

**Rationale**: Honors FR-010 in both situations without lost errors.

## R6 — Preview

**Decision**: Pure CSS/markup component per format with `aria-hidden`, dimmed, invented sample values ("Jahr; Brutto; Netto" etc.), identical for all features, no inputs besides the format.

**Rationale**: FR-006, no data access, nothing sensitive.

## R7 — Disabled state

**Decision**: Link is a `<button>` with `[disabled]` and `pTooltip` showing the definition's `disabledTooltipKey`; a disabled native button swallows clicks and keyboard activation, and the dialog open signal is additionally guarded.

**Rationale**: FR-011. Tooltip on a disabled button needs a wrapper element for hover events — the wrapper carries the tooltip.

## R8 — i18n and docs

**Decision**: Replace the now unused `export.buttonLabel/format*Description` keys; add `export.dialog.*` in `de.ts` and `en.ts` (existing key-parity specs apply). Update the user-guide sections that mention the "Export-Splitbutton" (de + en).
