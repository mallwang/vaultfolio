# Feature Specification: Export Modal Dialog

**Feature Branch**: `036-export-modal-dialog`

**Created**: 2026-10-03

**Status**: Draft

**Design**: [design.md](design.md)

**Input**: User description: "Rework the shared export control into a single text/icon link in the primary color labelled 'Daten exportieren', replacing the light-blue split button on all features. Clicking it opens a modal with one card per export format (PDF, Excel, CSV, JSON), each explaining the format, showing a static preview, the expected file name, the data included and what the format is best suited for. Each card has its own export button; no 'Export all'."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Choose and download a format from an explained overview (Priority: P1)

A user on any data feature page (e.g. Holdings, Earnings Development) sees a single, unobtrusive "Daten exportieren" link with an icon in the primary color instead of the split button. Clicking it opens a modal presenting four cards — PDF, Excel, CSV, JSON. Each card tells the user what they will get (format, file name, included data) and what the format is good for, so they can pick the right one without trial and error. Pressing the export button of a card downloads exactly that format.

**Why this priority**: This is the core of the rework: replaces the opaque split-button menu with an informed choice. Without it nothing else has value.

**Independent Test**: On one feature page, click the link, verify four cards with their information are shown, press the export button of one card and verify the file with the displayed name is downloaded.

**Acceptance Scenarios**:

1. **Given** a feature page with export enabled, **When** the user clicks "Daten exportieren", **Then** a modal opens listing exactly four format cards (PDF, Excel, CSV, JSON) and no "export all" action.
2. **Given** the modal is open, **When** the user presses the export button on the PDF card, **Then** only a PDF is generated and downloaded, and its file name equals the file name shown on the card.
3. **Given** the modal is open, **When** the user reads a card, **Then** it shows a short explanation, a static preview, the file name, the file format, the included data, and what the format is best / not suited for.
4. **Given** the user is on any of the seven features that offered the split button, **When** the page loads, **Then** the split button is gone and the "Daten exportieren" link appears in the same place.

---

### User Story 2 - Export several formats in one visit (Priority: P2)

A user who wants both a printable PDF and an Excel file for further analysis exports them one after another without closing and reopening anything.

**Why this priority**: Explicitly requested benefit of the modal; builds on Story 1.

**Independent Test**: Open the modal, export PDF, then export Excel without closing the modal; both files are downloaded.

**Acceptance Scenarios**:

1. **Given** the modal is open and one export finished, **When** the user presses the export button of another card, **Then** that second format is downloaded and the modal remains open throughout.
2. **Given** an export is running on one card, **When** the user looks at the cards, **Then** only the running card shows a busy state and cannot be triggered again, while the other cards remain usable.

---

### User Story 3 - Feature-specific description of what is contained (Priority: P2)

For features whose export differs from the standard (e.g. Earnings Development, where CSV delivers a ZIP archive of four CSV files), the card states this precisely, including the resulting file name and extension. Other features show the standard description (e.g. a single CSV file).

**Why this priority**: Prevents surprises (a ZIP instead of a CSV) and is the main source of user trust in the modal's information.

**Independent Test**: Open the modal on Earnings Development and on Holdings; the CSV card differs (ZIP with four files vs. single CSV) including the displayed extension.

**Acceptance Scenarios**:

1. **Given** the Earnings Development page, **When** the user views the CSV card, **Then** it states that four CSV files are delivered zipped and shows a file name ending in `.zip`.
2. **Given** a feature without a special export, **When** the user views the CSV card, **Then** it describes one `.csv` file with the feature's data.

---

### User Story 4 - Export unavailable state (Priority: P3)

When a feature's export is currently unavailable (e.g. no data yet), the link stays visible but is disabled, explains why via the existing tooltip, and the modal cannot be opened.

**Why this priority**: Preserves existing behavior of the split button.

**Independent Test**: On a feature in the disabled state, hover the link to see the reason and click it; no modal opens.

**Acceptance Scenarios**:

1. **Given** export is unavailable for a feature, **When** the user hovers the link, **Then** the existing explanatory tooltip is shown.
2. **Given** export is unavailable, **When** the user clicks or activates the link by keyboard, **Then** nothing opens.

---

### Edge Cases

- An export fails (e.g. chart capture or data fetch error): the affected card leaves its busy state, the user sees an error message, the modal stays open and other cards keep working.
- The user closes the modal (button, Esc, outside click) while an export is running: the download still completes.
- The UI language is switched: card texts, file names and tooltips follow the active language the next time the modal opens.
- Narrow (mobile) screens: cards stack vertically and the modal scrolls instead of overflowing.
- Keyboard and screen-reader users: link and modal are operable by keyboard, focus is trapped in the modal and returns to the link on close, each card's export button has an accessible name identifying its format.
- Placeholder features without real data still show the same link and modal consistently.
- Feature title contains characters not allowed in file names: the displayed file name matches the sanitized name actually downloaded.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The system MUST replace the export split button on every feature that currently has it (Holdings, Account Overview, Earnings Development, Retirement, Insurances, Budget Planner, Historic Wealth Development) with a single "Daten exportieren" link with icon, styled in the primary color like other text/icon links in the app.
- **FR-002**: Activating the link MUST open a modal dialog presenting one card each for PDF, Excel, CSV and JSON.
- **FR-003**: Each card MUST show: format name, a short explanation, a static visual preview, the expected export file name, the file format/extension, the data that is exported, and what the format is best suited for and not suited for.
- **FR-004**: The displayed file name and extension MUST be identical to the file actually downloaded for the current language and feature.
- **FR-005**: The "data included" description MUST default to a generic text per format and MUST be overridable per feature (e.g. Earnings Development CSV: four CSV files as one ZIP archive).
- **FR-006**: The static preview MUST NOT depend on or reveal the user's real data and MUST NOT trigger any data retrieval when the modal opens.
- **FR-007**: Each card MUST contain its own export button that exports only that format; the modal MUST NOT offer an "export all" action.
- **FR-008**: The modal MUST stay open after an export so the user can export further formats.
- **FR-009**: While a format is being exported, its card MUST show a busy state and prevent repeated triggering; other cards MUST remain usable.
- **FR-010**: If an export fails, the system MUST inform the user with an error message and restore the card to a usable state.
- **FR-011**: When export is unavailable for a feature, the link MUST remain visible but disabled, show the existing explanatory tooltip, and MUST NOT open the modal.
- **FR-012**: The content of the exported files (PDF, Excel, CSV, JSON) MUST remain unchanged by this feature.
- **FR-013**: All new texts MUST be available in every language the app supports and follow the active language.
- **FR-014**: The link, modal and per-card buttons MUST be keyboard-operable and accessible, and MUST expose stable test identifiers for automated UI verification.
- **FR-015**: The modal layout MUST adapt to narrow screens by stacking cards.
- **FR-016**: The redesigned export entry point MUST be a single shared component so that all features behave identically.

### Key Entities

- **Export Format Card**: One selectable format in the modal — format, explanation, preview, file name, file extension, included-data description, suitability hints (best for / not suited for), running state.
- **Feature Export Description**: Per-feature optional override of the "included data" text and resulting file extension for a given format; falls back to the generic description.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A user can open the export dialog and start a chosen format download in at most 2 clicks from any feature page.
- **SC-002**: 100% of the seven features show the new link and none shows the old split button.
- **SC-003**: For every feature and format, the file name shown on the card matches the downloaded file name in 100% of cases.
- **SC-004**: A user can export at least two different formats in one dialog session without reopening it.
- **SC-005**: In a usability check, at least 90% of test users correctly choose the suitable format for "print/archive personally" vs. "process data further" using only the card information.
- **SC-006**: The dialog opens instantly (no perceptible wait, no data loading) on all features.
- **SC-007**: The dialog is fully usable at 360 px viewport width with no horizontal scrolling.

## Assumptions

- The four formats and their generated content are exactly those of the existing export; no new formats are introduced.
- The link is placed where the split button currently sits on each page; its label is "Daten exportieren" (German) with an equivalent translation in other supported languages.
- Previews are generic illustrative mock-ups per format (page, spreadsheet, text rows, code snippet), identical across features and shown dimmed.
- Generic suitability texts per format (PDF: personal viewing, filing, printing; Excel: calculations and analysis; CSV: import into other tools; JSON: technical processing/backup, not for reading or printing) apply to all features.
- Closing the modal does not cancel a running export.
- No "export all" and no format pre-selection or remembering of last-used format.
