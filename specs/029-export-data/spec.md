# Feature Specification: Data Export (Per-Feature and Full Account)

**Feature Branch**: `029-export-data`

**Created**: 2026-09-08

**Status**: Draft

**Input**: User description: "I would like to enable the user to export the holdings:

- as JSON
- as CSV (not sure if Excel would be a better option or maybe additionally)
- as PDF which displays the holdings and the charts (like in the holdings page)
- the user should be able to click on the export button, which then shows the options (split-button with material icons - csv, table, json, pdf)
- the button should be on the left side of the "Add holding" button using the "info" severity
- the functionality should be reusable for all other features (account-overview, retirement, insurances, haushaltsplaner, wealth development
- note that the header and all translations must depend on the users browser language, so that the user is able to read all datafields
- additionally, in the PDF export, it should contain a infobox about the feature (e.g. "holdings") and what this data is about and what the export contains (maybe some text is already available in some of the user-guides)
- the "Export my data (optional)" should then simply export all data of all features in all formats (e.g. vaultfolio-data-export.zip -> contains one subdirectory per feature like "holdings" and for each feature all different exports like "holdings.json", "holdings.csv", "holdings.xlsx", "holdings.pdf") - the export-all must therefore be easily extendible"

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Export holdings in a single format (Priority: P1)

A user on the Holdings page wants a copy of their holdings data to use outside Vaultfolio (e.g. to file with a tax return, share with an advisor, or archive). They click an Export control next to "Add holding", choose one format (JSON, CSV, or PDF), and receive a downloaded file containing their current holdings — the PDF additionally showing the same distribution charts visible on the Holdings page.

**Why this priority**: This is the concrete, explicitly requested capability and the smallest slice that delivers real value on its own.

**Independent Test**: Can be fully tested by opening Holdings, choosing each format in turn, and verifying each downloaded file opens and contains the user's current holdings data (and, for PDF, the charts and an explanatory infobox).

**Acceptance Scenarios**:

1. **Given** a user with holdings, **When** they open the Export control on the Holdings page and choose "JSON", **Then** a file downloads containing every holding's field data in JSON.
2. **Given** a user with holdings, **When** they choose "CSV", **Then** a file downloads with one row per holding and a column per data field, readable in a spreadsheet application.
3. **Given** a user with holdings, **When** they choose "PDF", **Then** a file downloads showing the holdings in tabular form, the same distribution charts shown on the Holdings page, and an infobox explaining what "Holdings" data is and what the export contains.
4. **Given** a user with no holdings yet, **When** they open the Export control, **Then** they can still export and receive a validly formatted but empty export (with headers/structure but no data rows), rather than an error.
5. **Given** a user whose browser language is German, **When** they export in any format, **Then** column headers, labels, and the PDF infobox text appear in German; when the browser language is English (or another supported language), the same elements appear in that language.

---

### User Story 2 - Same export control on every data-holding feature (Priority: P2)

A user browsing Account Overview, Retirement, Insurances, Haushaltsplaner ("household budget"), or Wealth Development wants to export that feature's data the same way they already learned to on Holdings, without re-learning a different control per feature.

**Why this priority**: Reuse across features is explicitly requested and is what turns the Holdings work into a platform capability, but it only has value once User Story 1 exists to be reused.

**Independent Test**: Can be fully tested by opening each of the listed features in turn, confirming an Export control appears in the same relative position with the same behavior, and confirming the downloaded files contain that feature's own data with feature-appropriate column headers and infobox text.

**Acceptance Scenarios**:

1. **Given** a user on any of Account Overview, Retirement, Insurances, Haushaltsplaner, or Wealth Development, **When** they look at the page's primary action area, **Then** they see an Export control positioned immediately to the left of that page's primary "Add" action, in the same visual style as Holdings.
2. **Given** a user exports from a non-Holdings feature, **When** they open the resulting PDF, **Then** the infobox names that specific feature and describes that feature's data, not Holdings' text.
3. **Given** a new data-holding feature is added to Vaultfolio in the future, **When** a developer wires it into the shared export capability, **Then** no changes to the JSON/CSV/PDF generation logic itself are required — only feature-specific data and text need to be supplied.

---

### User Story 3 - Export everything in one download (Priority: P3)

A user in Account Settings clicks "Export my data (optional)" (currently a placeholder shown before account deletion) and receives a single archive containing every feature's data in every supported format, organized so they can find any one file without help.

**Why this priority**: This depends on User Story 1 and 2 already existing per feature; it is an aggregation convenience and the least urgent of the three, though it completes an existing but currently non-functional UI affordance.

**Independent Test**: Can be fully tested by clicking "Export my data" and verifying the downloaded archive contains one subdirectory per feature, each with that feature's JSON, CSV, and PDF (and Excel, where offered) files, all reflecting the user's real data.

**Acceptance Scenarios**:

1. **Given** a user with data in several features, **When** they click "Export my data (optional)", **Then** a single archive file downloads (e.g. `vaultfolio-data-export.zip`).
2. **Given** the downloaded archive, **When** the user extracts it, **Then** it contains one subdirectory per feature (e.g. `holdings/`, `account-overview/`, `retirement/`), each holding that feature's exports named after the feature (e.g. `holdings.json`, `holdings.csv`, `holdings.pdf`).
3. **Given** a feature the user has no data in, **When** the full export runs, **Then** that feature's subdirectory is still included with valid, empty-but-well-formed exports rather than being silently skipped.
4. **Given** a new feature is later added to the reusable export capability, **When** "Export my data" runs, **Then** its subdirectory appears in the archive automatically, without bespoke changes to the full-export flow.

### Edge Cases

- What happens when a user has zero data rows in a feature? Export still succeeds and produces a validly structured, empty export (see US1 Scenario 4).
- What happens when a data field contains characters that are special in CSV (commas, quotes, newlines) or in filenames? Values are safely escaped/quoted in CSV; filenames use only the fixed, ASCII feature-name pattern shown in this spec (e.g. `holdings.csv`), never user-supplied content.
- What happens when the export is requested while the underlying data is very large? The export still completes; response time expectations are captured in Success Criteria.
- What happens when the user's browser language is one Vaultfolio does not yet support? The export falls back to the same default language the rest of the application already falls back to.
- What happens when generation of one format fails during a full "Export my data" run? The archive still downloads with every feature/format that succeeded; the failed piece is simply omitted, and the user is told which feature/format failed so they can retry that one individually via its own page's Export control.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: On the Holdings page, the system MUST provide an Export control positioned immediately to the left of the "Add holding" action, visually styled with the "info" emphasis (distinct from the primary "Add" action and from destructive actions).
- **FR-002**: The Export control MUST, on activation, present the individual export format choices (JSON, CSV, PDF, and — per FR-003a — Excel) each with a distinguishing icon, without navigating away from the page.
- **FR-003**: Choosing a format MUST download a file containing the current user's holdings data rendered in that format, reflecting the data as currently shown on the page.
- **FR-003a**: The system MUST offer an Excel (`.xlsx`) export in addition to CSV, since CSV alone cannot carry per-column type/formatting and a user comparing the two is likely to want the richer option; CSV remains available for users/tools that require a plain-text format.
- **FR-004**: The PDF export MUST include the same distribution charts currently shown on the Holdings page, rendered as static images/graphics in the document.
- **FR-005**: The PDF export MUST include an infobox describing the feature the data belongs to (e.g. "Holdings"), what that data represents, and what the export file contains. Where suitable descriptive text already exists in the end-user documentation, it MUST be reused rather than re-written from scratch.
- **FR-006**: All labels, column headers, generated filenames' human-readable parts, and PDF text produced by an export MUST be presented in the language the user's browser (or in-app language selection, if already set) resolves to, using the same language/translation mechanism already used elsewhere in Vaultfolio, so that every data field is legible to the user.
- **FR-007**: Every data field visible to the user in a feature's normal UI MUST also appear, with an equivalent human-readable label, in that feature's JSON, CSV/Excel, and PDF exports.
- **FR-008**: The export capability (control, format menu, generation of JSON/CSV/Excel/PDF, and infobox rendering) MUST be implemented as a shared, reusable capability that each data-holding feature (Holdings, Account Overview, Retirement, Insurances, Haushaltsplaner, Wealth Development) can adopt by supplying its own data, column definitions, and descriptive text — without duplicating the export/generation logic per feature.
- **FR-009**: Each of Account Overview, Retirement, Insurances, Haushaltsplaner, and Wealth Development MUST present the same Export control, in the same position relative to that feature's primary "Add" action, with the same four/five format choices and the same behaviors described in FR-002–FR-007, scoped to that feature's own data.
- **FR-010**: The existing "Export my data (optional)" action (shown today in Account Settings' danger zone, ahead of account deletion) MUST become functional: activating it produces a single downloadable archive containing every data-holding feature's exports.
- **FR-011**: The full-export archive MUST be organized as one subdirectory per feature, using the same feature-name pattern as FR-012, each subdirectory containing that feature's JSON, CSV, Excel, and PDF exports (e.g. `holdings/holdings.json`, `holdings/holdings.csv`, `holdings/holdings.xlsx`, `holdings/holdings.pdf`).
- **FR-012**: The full-export capability MUST be built so that adding a new feature to the shared per-feature export capability (FR-008) automatically includes that feature's subdirectory in future full exports, with no dedicated code changes to the full-export flow itself.
- **FR-013**: Every export (single-format or full) MUST only ever contain data owned by the requesting user.
- **FR-014**: A feature with no data yet MUST still produce valid, correctly structured (headers/columns present, zero data rows) exports in every format, both for single-format and full export.
- **FR-015**: If generating one feature's export in one format fails during a full "Export my data" run, the system MUST still deliver the archive with every other feature/format that succeeded, omit only the failed piece, and tell the user which feature/format failed so they can retry it individually from that feature's own Export control.

### Key Entities

- **Export Request**: A user-initiated action naming one feature and one target format (or, for the full export, all features and all formats); scoped to the requesting user's own data.
- **Feature Export Definition**: The reusable per-feature configuration a feature registers with the shared export capability — its data source, the set of exportable fields/columns and their translated labels, and the descriptive text shown in its PDF infobox.
- **Export Archive**: The single downloadable file produced by "Export my data", containing one subdirectory per feature and that feature's individual export files.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A user can go from opening the Export control to having a downloaded single-format file in under 5 seconds for typical data volumes (up to a few hundred records in the feature).
- **SC-002**: 100% of data fields visible in a feature's on-screen table/detail view are present in that feature's exports, verified per feature at rollout.
- **SC-003**: A user whose browser is set to a supported non-default language sees every export label and PDF text in that language, with zero untranslated/placeholder strings, across all six features.
- **SC-004**: Adding the export capability to a new feature (beyond the initial six) requires supplying only that feature's data/labels/text — measured by the shared capability requiring no changes for the new feature to appear correctly in "Export my data".
- **SC-005**: A user can produce a complete "Export my data" archive covering all six features in under 30 seconds for an account of typical size, and the archive opens with a standard archive tool showing one folder per feature.
- **SC-006**: Support requests asking "how do I get my data out of Vaultfolio" are eliminated for any of the six covered features, since a self-serve export is available directly on each feature's page and from Account Settings.

## Assumptions

- The six in-scope features for reuse are exactly those named by the user: Holdings, Account Overview, Retirement, Insurances, Haushaltsplaner, and Wealth Development; any further feature adopting the export capability later follows the same reusable pattern described here.
- "CSV" and the newly-added "Excel" export contain the same tabular data; Excel is added alongside CSV (per FR-003a) rather than replacing it, since the user's own note flagged uncertainty about which was preferable and both have distinct legitimate uses.
- The PDF's charts are static renderings of the same distribution charts already computed for on-screen display, not new chart types.
- "The users browser language" is resolved the same way Vaultfolio already resolves display language elsewhere in the app (browser locale, with any existing in-app language override taking precedence), reusing the existing localization/translation mechanism rather than introducing a new one.
- Descriptive infobox text is sourced from the existing end-user documentation where suitable content already exists for a feature, and freshly written (following the same style) where it does not.
- Exports are generated on demand at the time of the request and reflect the data at that moment; no scheduled/recurring export or export history is in scope.
- The Export control's exact icon set (JSON/CSV/Excel/PDF) uses the same icon system already used throughout Vaultfolio (Material icons), one distinct icon per format.
- Only the requesting user's own data is ever included, consistent with the account-deletion export's existing "own data only" scope.
