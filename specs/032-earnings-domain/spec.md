# Feature Specification: Earnings Domain

**Feature Branch**: `032-earnings-domain`

**Created**: 2026-09-29

**Status**: Draft

**Design**: [design.md](design.md) — approved mockup covering the overview, tables, data check, imports/privacy, import preview (incl. correcting a misread figure, issue #63), and edge states.

**Input**: User description: "Earnings domain ("Einkommensentwicklung" DE / "Earnings" EN): a new, independent Vaultfolio domain (like Holdings) that lets every user — administrators and members alike — see how their employment income developed over the years (monthly payslips, bonuses, wage tax, social-insurance contributions), based on a proven standalone local app (earnings-evolution). Data entry is upload-only (no manual entry): text-based payslip PDFs parsed in the user's browser by a format-specific parser (first: SAP-based "Entgeltnachweis", evosoft/Siemens), annual wage-tax certificates (Lohnsteuerbescheinigung) via one generic parser, and a versioned JSON export from the companion local tool for historic/scanned payslips. The original PDF never leaves the device; only whitelisted figures are sent. Every record must pass arithmetic checks, re-run by the server; a file with any failing record is always rejected as a whole. Amounts are encrypted at rest with a server-held key; data is strictly per owner (no admin view); access is granted per user via domain entitlement; logs never contain amounts. Views mirror the earnings-evolution overview (career totals, KPI tiles, gross per year, monthly breakdown, deduction ratios, month detail statement, year × month grid, taxes per year, tax certificates, data check, import page/history), fully in English and German, light and dark. Out of scope: generic EBV parser, VZE/BSAV statements and fiscal-year bonus toggle, further payroll-system parsers (iteration 2); in-browser OCR (iteration 3); LLM/cloud parsing; storing documents; manual entry."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Import payslips from PDF and see them checked (Priority: P1)

As an employee who receives a monthly payslip PDF from my employer, I want to drop one or many of these PDFs onto an import page, see what was recognized in each file (employer, month(s), whether the numbers add up), and confirm the import — without ever typing a single figure myself and without the PDF itself leaving my device — so my earnings history is built from exactly what my employer printed.

**Why this priority**: Without a trustworthy way to get data in, nothing else in the domain has any value. Upload-only import with arithmetic checks is the domain's defining principle (manual entry is deliberately not offered, because payroll and tax figures are too error-prone to type in correctly), and keeping the document on the user's device is the core privacy promise.

**Independent Test**: Can be fully tested by uploading a set of supported payslip PDFs (including one with a correction section for an earlier month, one duplicate, and one deliberately inconsistent or unsupported file), confirming the preview shows the right per-file outcome, confirming the import, and checking the import history lists exactly the accepted files — with no document content reaching the server.

**Acceptance Scenarios**:

1. **Given** a user entitled to the Earnings domain opens the import page, **When** they select several supported payslip PDFs at once, **Then** the system shows, per file, the recognized document type, employer, the month(s) it contains, the result of every arithmetic check, and whether each month is new, a duplicate of an already imported file, or replaces previously imported data.
2. **Given** the preview shows only files that passed all checks, **When** the user confirms, **Then** all records are saved and appear in the import history and the overview, and the preview is cleared.
3. **Given** a payslip contains a section for an earlier month (a correction), **When** it is imported, **Then** that section is stored as a correction record counted toward the month it belongs to — not the month the payslip was issued.
4. **Given** a selected file contains any record whose figures do not add up (e.g., gross − taxes − social insurance ≠ net by more than one cent), **When** the preview is shown, **Then** the whole file is marked as rejected with a translated explanation naming the failing check, the month, the difference and the involved figures, its figures are shown in the grid with those figures highlighted, and none of its records can be saved while a check still fails.
   4a. **Given** a rejected file in the preview, **When** the user corrects an involved figure inline, **Then** all checks re-run immediately, the status updates live (rejected → corrected once every check passes), the corrected figure is marked "corrected by you", and only then can the file be imported; a still-failing file cannot be imported.
   4b. **Given** a corrected file is imported, **When** the server receives it, **Then** it re-runs all checks on the submitted figures and rejects the file if any fails; the saved record and the import history show which figures were corrected by the user.
5. **Given** a selected file is not a recognized document format (another employer's payroll layout, a scanned image, an unrelated PDF), **When** the preview is shown, **Then** the file is rejected with a translated "format not supported yet" message and the remaining files in the selection are unaffected.
6. **Given** the user selects a file identical to one already imported, **When** the preview is shown, **Then** it is marked as a duplicate and saving it creates no additional records.
7. **Given** the user imports a payslip for a month that already has records from the same employer, kind, and sequence, **When** they confirm, **Then** the new records replace the previous ones for that month, and the preview told them so beforehand.
8. **Given** a user is importing, **When** the file is processed, **Then** the PDF and its text never leave the user's device — only the whitelisted figures are sent — and no personal identifiers printed on the payslip (tax ID, social-security number, bank account/IBAN, name, address) are transmitted or stored.
9. **Given** a user without Earnings entitlement, **When** they try to reach the Earnings domain or its data, **Then** access is denied, consistent with other domains.

---

### User Story 2 - See how my earnings developed over the years (Priority: P1)

As a user with imported earnings data, I want an overview that shows how my gross pay, net pay, taxes, social-insurance contributions, and bonuses developed — across my whole career, per employer, per year, and month by month — so I can understand my income trajectory and where my gross pay goes.

**Why this priority**: This is the reason users import their payslips. It shares P1 with US1 because import without visualization delivers no insight, and the overview without import has no data.

**Independent Test**: Can be fully tested by seeding a known set of pay records (multiple years, two employers, bonus months, a correction record) and verifying every total, ratio, and chart value on the overview matches exact hand-computed expectations in both languages.

**Acceptance Scenarios**:

1. **Given** a user has records from more than one employer, **When** they open the overview, **Then** they see an expandable "whole career" summary (period covered, months, number of employers, and totals) followed by one expandable summary per employer, each showing totals over the full employment and averages per month employed.
2. **Given** records exist for the latest and the previous year, **When** the overview loads, **Then** KPI tiles for the latest year show gross, net, taxes, social insurance, bonus, and net ratio, each with its change versus the previous year.
3. **Given** multi-year data, **When** the user views "gross per year", **Then** each year shows regular pay and bonus/one-off pay as separate parts, switchable between yearly totals and average per month employed.
4. **Given** multi-year data, **When** the user views the month-by-month breakdown, **Then** each month shows net, taxes, and social insurance stacking up to gross, bonus months are marked, employer changes are marked, and the user can narrow the visible time range.
5. **Given** multi-year data, **When** the user views deduction ratios, **Then** taxes and social insurance are shown as a percentage of gross per year.
6. **Given** the user clicks a month (in the breakdown or the year × month grid), **When** the month detail opens, **Then** it shows each payslip/section for that month as a statement (gross − taxes − social insurance = net ± other = payout), individual taxes and contributions can be expanded, and each entry names its import file and check status.
7. **Given** multi-year data, **When** the user views the year × month grid, **Then** they can choose the metric shown (e.g., gross, regular pay, bonus, net, taxes, social insurance, payout), bonus months are marked, and each year has a row total.
8. **Given** multi-year data, **When** the user views the table of taxes and contributions per year, **Then** each year (per employer) lists months, gross, bonus portion, tax gross, wage tax, solidarity surcharge, church tax, each social-insurance contribution, and the tax and social-insurance ratios.
9. **Given** an employer filter is set to one employer, **When** the user views any section, **Then** only that employer's data is shown; "all employers" restores the full view.
10. **Given** the user has no earnings data yet, **When** they open the domain, **Then** they see an empty state explaining what can be imported and a direct path to the import page, plus the privacy note.

---

### User Story 3 - Verify yearly totals against the wage-tax certificate (Priority: P2)

As a user who wants to trust the numbers, I want to import my annual wage-tax certificates and see, per employer and year, whether the sum of my payslips matches the year-to-date totals printed on the last payslip and the certificate, and whether any month is missing — so I know my history is complete and correct.

**Why this priority**: It turns the overview into a verified record and catches missing uploads, but the overview (US2) is already useful without it.

**Independent Test**: Can be fully tested by importing a year of payslips plus that year's wage-tax certificate and confirming the data check shows matching values; then removing one month's import and confirming the data check reports the gap.

**Acceptance Scenarios**:

1. **Given** a user uploads a wage-tax certificate PDF from any employer, **When** it is processed, **Then** the system recognizes the official form, extracts the year, employer, and the certified totals (gross wage, wage tax, solidarity surcharge, church tax, social-insurance contributions, and related lines), and shows them in the preview like any other import.
2. **Given** certificates are imported, **When** the user views the certificate table, **Then** it lists year, employer, and the certified totals, with a sum row.
3. **Given** payslips and a certificate exist for an employer and year, **When** the user views the data check, **Then** that row shows, separately, whether the payslip sums match the printed year-to-date totals, whether they match the certificate, and whether all months between the first and last month of that year are present.
4. **Given** a correction for a year was issued after that year's last payslip, **When** the data check compares totals, **Then** that late correction is excluded from both comparisons (neither printed value can contain it) and this exclusion is visible.
5. **Given** a year without a certificate, **When** the user views the data check, **Then** the certificate column shows "not available" rather than a failure.

---

### User Story 4 - Bring in historic and scanned payslips via the companion tool's export (Priority: P2)

As a user whose older payslips exist only on paper or as scans, I want to import the versioned JSON export produced by the companion local tool (which already did OCR, splitting, and verified corrections offline), so my full career history is in Vaultfolio even though scans cannot be read by the in-browser import yet.

**Why this priority**: It is the only way to include pre-PDF-era history in this iteration, but new, text-based payslips (US1) are the primary path for most users.

**Independent Test**: Can be fully tested by importing a sample export file of the supported schema version and confirming its records appear with correct amounts, while files with an unknown schema version, unexpected fields, or failing checks are rejected.

**Acceptance Scenarios**:

1. **Given** a JSON export of a supported schema version, **When** the user selects it on the import page, **Then** the preview shows its employers, periods, check results, and duplicate/replace status just like PDF imports.
2. **Given** an export whose schema version is unknown or unsupported, **When** it is processed, **Then** it is rejected with a translated message naming the supported version(s).
3. **Given** an export contains any field outside the whitelisted set (e.g., document text, file paths, notes, personal identifiers), **When** it is processed, **Then** the file is rejected — unexpected content is never silently stored.
4. **Given** an export contains any record whose figures do not add up, **When** it is processed, **Then** the whole file is rejected, as with PDFs.

---

### User Story 5 - Manage and delete my earnings data (Priority: P2)

As a user, I want to see every import I made and delete a single import or all my earnings data at once, so I stay in control of this sensitive information.

**Why this priority**: Control over highly sensitive personal data is a hard requirement, but it builds on data existing (US1).

**Independent Test**: Can be fully tested by making several imports, deleting one and confirming only its records disappear from every view, then deleting all earnings data and confirming the domain returns to its empty state.

**Acceptance Scenarios**:

1. **Given** the user has made imports, **When** they open the import history, **Then** each import lists file name, document/source type, import date, parser used, number of records, and the employers/periods covered.
2. **Given** an import in the history, **When** the user deletes it and confirms, **Then** exactly the records that import contributed are removed and every view updates accordingly.
3. **Given** the user chooses "delete all my earnings data" and confirms, **Then** all their earnings records, certificates, and import history are permanently removed, and the domain shows its empty state.
4. **Given** the user wants a different display name for a detected employer, **When** they rename it, **Then** all views use the new name; no figure can be edited.

---

### User Story 6 - Earnings stays private, even from administrators (Priority: P1)

As a user of a shared Vaultfolio instance, I want assurance that nobody else — including administrators — can see my earnings through the application, and that a copy of the database or a backup does not reveal my amounts, so I can safely store my salary history.

**Why this priority**: The domain holds some of the most sensitive personal data a person has; without these guarantees users should not (and would not) import anything. It is a cross-cutting constraint that must hold from the first release.

**Independent Test**: Can be fully tested by importing data as user A, then confirming that user B and an administrator cannot retrieve any of A's earnings through any screen or request; inspecting the stored database file to confirm no amount is readable in plain form; and inspecting logs from an import to confirm they contain no amounts or document content.

**Acceptance Scenarios**:

1. **Given** user A has earnings data, **When** user B or an administrator uses any part of the application, **Then** none of A's earnings data is visible or retrievable; administrators see only their own earnings.
2. **Given** earnings data is stored, **When** someone reads the database file or a backup without the server-held key, **Then** no monetary amount is readable.
3. **Given** an import happens, **When** logs are reviewed, **Then** they contain only import metadata (import id, content hash, record counts, parser and version, outcome) — never amounts or document content.
4. **Given** the user opens the Earnings domain, **When** they read the privacy note, **Then** it explains in plain language that documents stay on their device, which figures are stored, that amounts are encrypted at rest, that the instance operator runs the server, and how to delete their data.

---

### User Story 7 - Latest-year summary on the dashboard (Priority: P3)

As an entitled user, I want an optional dashboard widget with my latest-year earnings KPIs, so I see the headline numbers without opening the domain.

**Why this priority**: Convenience only; the domain is complete without it.

**Independent Test**: Can be fully tested by enabling the widget for an entitled user with data and confirming it shows the same latest-year values as the overview's KPI tiles, and that it is absent for a non-entitled user.

**Acceptance Scenarios**:

1. **Given** an entitled user with data, **When** they view the dashboard, **Then** the Earnings widget shows the latest-year gross, net, and net ratio with change versus the previous year, linking to the domain.
2. **Given** a non-entitled user, **When** they view the dashboard, **Then** no Earnings widget is offered.

---

### Edge Cases

- **Mixed selection**: a batch with some valid, some duplicate, some failing, and some unsupported files — each file gets its own outcome; only valid, non-duplicate files are saved on confirm, and the user is told which files were skipped and why.
- **Same month twice in one batch**: two files in the same selection contain the same month/employer/kind/sequence — the preview flags the conflict and only one can be saved (the later-issued payslip wins, and this is shown).
- **Correction for a month not yet imported**: the correction record is stored for its own month; that month appears with the correction only, and the data check reports the missing regular payslip.
- **Payslip with only back-payments (no regular pay for its own month)**: stored as a "payout-only" record so the month is not counted as a regular employment month.
- **Voluntary health/long-term-care insurance**: when the payslip shows contributions and an employer subsidy instead of statutory contributions, the employee's own share (contribution − subsidy) counts as social insurance, the subsidy is stored separately, and the net check uses the own share.
- **Scanned (image-only) PDF**: rejected as "format not supported yet", with a hint that scanned documents can be processed with the companion tool and imported via its export.
- **Password-protected or corrupted PDF**: rejected with a translated, specific message; nothing is sent.
- **Very large selection**: the user can select at least a full career of monthly payslips (e.g., 20 years × 13 files) in one go; progress is shown and the page stays responsive.
- **Year with fewer than 12 months** (joining/leaving an employer mid-year): per-month averages and completeness use the months actually employed; only gaps between the first and last month of that year count as missing.
- **Negative amounts**: correction records may legitimately carry negative values and must display and total correctly.
- **Deleting an import that other data depends on**: deleting a payslip import that a certificate check relied on simply turns that year's check into a mismatch or gap — no cascade to certificates.
- **Server-held key missing or wrong**: the domain reports that earnings data is temporarily unavailable rather than showing wrong or empty numbers, and no new data is accepted until the key is available.
- **Entitlement revoked**: the user loses access to the domain but their data is retained (as with other domains) until they or account deletion remove it.
- **Account archived**: earnings data follows the same retention rules as the user's other owned data — kept while the account can still be restored, permanently removed when the account is purged.
- **Misread digit in a scanned document's text layer** (e.g. Deutsche Bundesbank scans from 2011: `0166-` instead of `066-`): the check rejects the file; the preview shows its figures with the failing check and the involved figures highlighted; the user corrects the misread figure inline and, once all checks pass, can import it, marked as corrected.
- **Correction that passes all checks but differs from the document**: the checks cannot detect it; the "corrected by you" marker in preview and history is the mitigation, and only figures involved in a failing check can be edited.
- **Tampered correction request**: a request with figures that fail a check, unknown figures in the corrected list, or fields outside the whitelist is rejected by the server regardless of what the browser displayed.
- **Rounding**: all amounts are exact to the cent; totals and ratios over many years never drift.

## Requirements _(mandatory)_

### Functional Requirements

**Domain and access**

- **FR-001**: The system MUST provide a new, independent Earnings domain ("Earnings" in English, "Einkommensentwicklung" in German) with its own navigation entry, following the same domain structure and entitlement mechanism as the existing domains.
- **FR-002**: Access to the Earnings domain MUST be granted per user through the existing domain-entitlement mechanism and MUST NOT be granted to members by default. Administrators may use the domain for their own data like any other user.
- **FR-003**: All earnings data MUST be owned by exactly one user and MUST only ever be visible to, retrievable by, modifiable by, or deletable by that user. No administrative screen, report, or request may expose another user's earnings.

**Import (upload only)**

- **FR-004**: The system MUST NOT offer any way to create monetary figures manually. The only ways to add earnings data are the document imports in FR-005–FR-007. The single exception is FR-012a: in the import preview, a user MAY correct a figure that a parser read from a document and that takes part in a failing arithmetic check.
- **FR-005**: Users MUST be able to import text-based payslip PDFs in the SAP-based "Entgeltnachweis" format (first supported format), including payslips with several sections where sections for earlier months are corrections.
- **FR-006**: Users MUST be able to import annual wage-tax certificate (Lohnsteuerbescheinigung) PDFs from any employer, using the official form's standardized line structure.
- **FR-007**: Users MUST be able to import a JSON export file of the companion tool's versioned "earnings-export" schema. The system MUST reject files of an unknown/unsupported schema version and files containing any field outside the whitelisted set.
- **FR-008**: PDF files MUST be read and interpreted entirely on the user's device. The PDF, its text, and any content other than the whitelisted figures (FR-017) MUST NOT be transmitted to the server or stored anywhere.
- **FR-009**: Personal identifiers printed on documents (tax ID, social-security number, bank account/IBAN, employee name, address, personnel number) MUST NOT be transmitted or stored.

> **Amendment (033-parser-requests, FR-043)**: FR-008 and FR-009 apply to the original PDF, its raw text, personal identifiers and real figures, which still never leave the device. The opt-in, consented, user-reviewed parser-request flow of [033](../033-parser-requests/spec.md) may transmit a _derived, anonymized, rebuilt_ sample (structured layout data with all personal data removed and every figure replaced by a random value of the same shape); the server stores only a PDF it generated itself from that data.

- **FR-010**: Users MUST be able to select multiple files in one import. Before anything is saved, the system MUST show a per-file preview: recognized document type, employer, contained periods, each check's result, and whether each record is new, a duplicate, or replaces existing data. Nothing is saved until the user confirms.
- **FR-011**: Each payslip record MUST pass the arithmetic checks before it can be saved: gross − (wage tax + solidarity surcharge + church tax) − (health + long-term care + pension + unemployment insurance) = statutory net, within one cent; and, per payslip, the sum of statutory net plus other deductions/additions across its sections equals the printed payout, within one cent. Format-specific additional checks MAY apply.
- **FR-012**: If any record in a file fails any check, the whole file MUST NOT be imported — no partial import, no import with a warning flag — until every check passes (FR-012a). The user MUST see a translated explanation naming the failing check, the month, the difference and the figures that take part in that check.
- **FR-012a**: A file rejected by a check MUST be shown in the preview with the same "figures that will be sent" grid as a valid file. The figures taking part in each failing check MUST be highlighted by colour and icon (not colour alone). Only those figures MUST be editable, inline, and only in the browser: an edit MUST re-run all checks on the device immediately and update the file's status (rejected → corrected). The file becomes importable only when all checks pass. An edit MUST NOT survive re-reading the file or leaving the import page. Edited figures MUST be marked "corrected by you" in the preview, and every saved corrected figure MUST remain marked as such in the import history and wherever the record's figures are shown. Edited values MUST NOT appear in logs or error reports.
- **FR-013**: The server MUST independently re-run all checks on submitted figures — including user-corrected ones — and MUST reject any submission that fails them or that does not match the whitelisted structure (including the list of corrected figures, which MUST only name known figures), regardless of what the user's device reported.
- **FR-014**: A file that matches no supported format MUST be rejected with a translated "format not supported yet" message; for image-only (scanned) PDFs the message MUST mention the companion-tool export as the way to import scans.
- **FR-015**: The system MUST detect re-imports of an identical file (by content fingerprint) and MUST NOT create duplicate records from them.
- **FR-016**: A pay record MUST be identified by employer + period (month the values belong to) + kind + sequence. Importing a record with an existing identity MUST replace the stored one, and the preview MUST announce the replacement before confirmation.
- **FR-017**: The stored figures per pay record MUST be limited to: employer, period, issue month, kind (regular / correction / payout-only), sequence, total gross, tax gross, social-insurance gross bases, wage tax, solidarity surcharge, church tax, health, long-term care, pension and unemployment insurance (employee share), statutory net, other deductions/additions, payout, the one-off (bonus) portion of the relevant amounts, employer health/long-term-care subsidy, the printed year-to-date totals needed for the data check, and each check's result. Per certificate: employer, year, and the certified totals needed for the data check.
- **FR-018**: Corrections MUST count toward the month they belong to (the period), not the month they were paid out.
- **FR-019**: For voluntarily insured employees, health and long-term-care insurance MUST be counted as the employee's own share (contribution − employer subsidy); the subsidy MUST be stored separately.
- **FR-020**: The employer MUST be detected from the document. Users MAY change an employer's display name; this MUST NOT change any figure.
- **FR-021**: Every successful import MUST be recorded with: original file name, source type (payslip PDF, certificate PDF, companion-tool export), content fingerprint, parser identity and version, number of records, covered employers/periods, import date, and which figures of which record the user corrected (names only, never values).
- **FR-022**: Import progress MUST be visible for multi-file selections, and the page MUST stay usable while files are processed.

**Overview and views**

- **FR-023**: The domain MUST offer an employer filter (all employers or one).
- **FR-024**: The domain MUST show a career summary: an expandable "whole career" entry (shown only when more than one employer exists) and one expandable entry per employer, each with period covered, months employed, totals (gross, net, taxes, social insurance, bonus, net ratio), and averages per month employed.
- **FR-025**: The domain MUST show KPI tiles for the latest year with data — gross, net, taxes, social insurance, bonus, net ratio — each compared to the previous year, noting when the latest year is incomplete (e.g., "2026 (9 months)").
- **FR-026**: The domain MUST show gross per year split into regular pay and bonus/one-off pay, switchable between yearly totals and average per month employed.
- **FR-027**: The domain MUST show a month-by-month breakdown where net, taxes, and social insurance stack up to gross, with bonus months and employer changes marked, an adjustable visible time range, and a click on a month opening that month's detail.
- **FR-028**: The domain MUST show taxes and social insurance as a percentage of gross per calendar year.
- **FR-029**: The month detail MUST show each payslip/section of that month as a statement (gross − taxes − social insurance = net ± other = payout), with the individual taxes and contributions expandable, a residual line for any non-itemized difference, and each section's import file name, kind (regular/correction/payout-only), and check status.
- **FR-030**: The domain MUST show a year × month grid with a selectable metric (at least gross, regular pay, bonus, net, taxes, social insurance, payout), bonus months marked, a row total per year, and clickable cells opening the month detail.
- **FR-031**: The domain MUST show a table of all taxes and contributions per year (per employer): months, gross, bonus portion, tax gross, wage tax, solidarity surcharge, church tax, each social-insurance contribution, tax ratio, and social-insurance ratio.
- **FR-032**: The domain MUST show a table of imported wage-tax certificates with the certified totals and a sum row.
- **FR-033**: The domain MUST show a data check per employer and year: payslip sums vs. printed year-to-date totals of that year's last payslip, payslip sums vs. wage-tax certificate (or "not available"), and completeness (no missing regular months between the first and last month of the year). Corrections issued after the year's last payslip MUST be excluded from both comparisons, and this MUST be visible. A year without any regular payslip (e.g. only a certificate imported) MUST be shown as "no payslips" with the certificate marked as not comparable — informational, not counted as a data-check issue.
- **FR-034**: The domain MUST show an empty state with a path to the import page when the user has no data.
- **FR-035**: The domain MUST show an in-app privacy note (FR-042).
- **FR-036**: The domain MUST offer a dashboard widget with the latest-year KPIs (gross, net, net ratio and change vs. previous year), shown only to entitled users, via the existing dashboard contribution mechanism.

**Data management**

- **FR-037**: Users MUST be able to view their import history (FR-021 fields) and delete a single import, which removes exactly the records that import contributed.
- **FR-038**: Users MUST be able to permanently delete all their earnings data (records, certificates, import history, employer display names) in one confirmed action.
- **FR-039**: Earnings data MUST follow the same account lifecycle as other owned data: kept while an archived account can still be restored, and permanently removed when the account is purged or deleted.
- **FR-040**: Earnings data MUST be included in the user's existing full "Export my data" archive and offered through the domain's own export control, consistent with the shared export capability, containing only the user's own data.

**Privacy and security**

- **FR-041**: All monetary amounts MUST be stored encrypted with a key held by the server and configured by the instance operator, so that the database file or a backup alone reveals no amount. Non-monetary identifying fields needed for lookup (period, employer, kind, sequence, year) MAY be stored in plain form.
- **FR-042**: The privacy note MUST state in plain language: documents stay on the user's device; which figures are stored; amounts are encrypted at rest; the instance operator runs the server and holds the key; no one else in the application, including administrators, can see the data; and how to delete it.
- **FR-043**: Logs, error reports, and diagnostic output related to earnings MUST NOT contain monetary amounts, document content, or personal identifiers — only import metadata (import id, content fingerprint, record counts, parser and version, outcome, error codes).
- **FR-044**: If the encryption key is missing or invalid, the domain MUST show that earnings data is temporarily unavailable, MUST NOT display wrong or partial figures, and MUST NOT accept new imports until the key is available.
- **FR-045**: Document interpretation MUST NOT use any external or cloud service (including AI/LLM services); all interpretation is deterministic and reproducible for the same input and parser version.

**Language, formatting, and presentation**

- **FR-046**: All texts — labels, chart legends and tooltips, table headers, check names, error and rejection messages, the privacy note — MUST be available in English and German and follow the user's selected app language.
- **FR-047**: German payroll terms MUST use an agreed English glossary (e.g., Gesamtbrutto → Gross (total gross), Nettoentgelt → Statutory net, Auszahlungsbetrag → Payout, Lohnsteuer → Wage tax, Solidaritätszuschlag → Solidarity surcharge, Kirchensteuer → Church tax, KV/PV/RV/AV → Health / Long-term care / Pension / Unemployment insurance, Einmalbezüge → Bonus & one-off payments, Lohnsteuerbescheinigung → Wage-tax certificate); document-type names MAY show the German original alongside.
- **FR-048**: Amounts, percentages, and dates MUST be formatted according to the user's language, and all amounts MUST be exact to the cent in every total, average, and ratio.
- **FR-049**: All views MUST work in light and dark themes and on narrow (phone-width) screens.

### Key Entities

- **Pay Record**: One payslip section's figures for one employer and one period (the month the values belong to). Attributes: owner, employer, period, issue month, kind (regular / correction / payout-only), sequence, the monetary amounts listed in FR-017 (encrypted at rest), one-off (bonus) portion, employer subsidy, printed year-to-date totals (on the regular record of a payslip), check results, and the import it came from.
- **Wage-Tax Certificate**: The official annual certificate for one employer and year. Attributes: owner, employer, year, certified totals (gross wage, wage tax, solidarity surcharge, church tax, social-insurance contributions, employer subsidies, multi-year compensation), and the import it came from.
- **Import**: One accepted file. Attributes: owner, original file name, source type (payslip PDF, certificate PDF, companion-tool export), content fingerprint, parser identity and version, record count, covered employers/periods, import date. Deleting it removes its records/certificates.
- **Employer**: The employer detected from documents, per owner. Attributes: detected name (the matching key) and optional user-chosen display name.
- **Corrected figure**: The name of a figure of one record that the user corrected in the import preview (never its value); stored with the import and shown wherever the record's figures are shown.
- **Check Result**: A named arithmetic or completeness check with its outcome and difference. Per-record checks gate the import; per-year checks (vs. year-to-date totals, vs. certificate, completeness) are computed for the data check view.
- **Earnings Export (companion-tool file)**: A versioned, whitelisted interchange format for pay records and certificates, produced by the companion local tool and accepted by the import.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A user can import a full year of monthly payslips (13 files incl. a bonus payslip) and see the updated overview in under 2 minutes, with no figure typed by hand.
- **SC-002**: For a reference set of real-format payslips, 100% of the figures shown in the overview equal the amounts printed on the payslips to the cent, and yearly sums equal the printed year-to-date totals and the wage-tax certificates.
- **SC-003**: 100% of files containing a record that fails an arithmetic check are rejected in full; no such record is ever stored.
- **SC-004**: During an import, zero bytes of PDF content or document text reach the server, verified by inspecting all traffic from the user's device during the import.
- **SC-005**: No request or screen available to any other user — including administrators — returns any part of another user's earnings data (verified for every earnings capability).
- **SC-006**: A copy of the database file contains no monetary earnings amount in readable form, and logs from a full import contain no amount, document text, or personal identifier.
- **SC-007**: Re-importing an already imported set of files creates zero additional records.
- **SC-008**: Every earnings screen, message, and chart is fully usable in both English and German, with no untranslated text.
- **SC-009**: A user can find and delete all their earnings data in under 1 minute, after which none of it is retrievable.
- **SC-010**: A user who previously used the companion tool can bring in their complete history (including scan-era years) through its export and see the same yearly totals the companion tool shows.

## Assumptions

- **Constitution amendment required**: The current constitution permits only manual UI entry or CSV/JSON import as data origins and lists no Earnings domain. This feature requires an amendment (Earnings domain in Product Scope; upload-only data origin including on-device PDF interpretation and the companion-tool export; sensitive-data rules: data minimization, no document storage, owner-only access, encryption at rest, no amounts in logs) before planning proceeds.
- **Iteration scope**: The SAP "Entgeltnachweis", the Deutsche Bundesbank "Verdienstabrechnung" and the Bundeswehr "Wehrsoldabrechnung" payslip formats (tasks T127–T134) and the wage-tax certificate are supported by on-device PDF import in this iteration. A generic parser for any German payslip (based on the legally standardized payslip terms, gated by the arithmetic checks), variable-bonus (VZE) and company-pension (BSAV) statements, the "count bonus in fiscal year" option, and further payroll-system formats (e.g., DATEV) are planned for iteration 2; on-device OCR for scanned payslips for iteration 3.
- **Correction in the preview (issue #63)**: Reverses FR-004's "no editing" and relaxes FR-012's "reject the whole file" for the preview only; the server stays authoritative (FR-013). Editable figures are limited to those taking part in a failing check so the feature cannot be used to enter arbitrary values. The constitution's Earnings rules need a matching amendment (data origin: user correction of a parsed figure) before implementation.
- **Companion tool**: The companion local tool (earnings-evolution) will gain an export command producing the versioned "earnings-export" format; defining that command is a dependency of US4 but is maintained outside this repository. Its first schema version is defined by this feature.
- **Money units**: Amounts are handled as exact decimal values in euros; the companion tool's integer-cent values are converted exactly on import. All amounts are in EUR (no other currencies).
- **Encryption key management**: The instance operator provides the key through server configuration. Losing the key makes stored amounts unrecoverable; this is documented for operators. Key rotation is not part of this iteration.
- **Honest threat model**: Encryption at rest protects database copies and backups; it does not protect against the instance operator, who runs the server and holds the key. The privacy note says so.
- **No document retention**: Because original PDFs are not stored, the overview shows import file names but cannot open the original document (unlike the companion tool's document links).
- **Test material**: Real payslips are personal data and must not be committed; automated tests use synthetic documents that reproduce the supported layouts, and exported-format fixtures with invented figures.
- **Entitlement**: Existing domain-entitlement behavior (including administrators' implicit access to every domain) applies; administrators' access to the domain never extends to other users' data (FR-003).
- **Existing capabilities reused**: authentication and sessions, domain entitlement, dashboard contribution mechanism, shared export capability (029), language/theme settings, and the standard charting approach.
