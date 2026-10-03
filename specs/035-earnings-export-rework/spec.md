# Feature Specification: Earnings Export Rework

**Feature Branch**: `035-earnings-export-rework`

**Created**: 2026-10-03

**Status**: Draft

**Input**: User description: "Rework all export options of the earnings development ("Einkommensentwicklung"). Phase 1 is the PDF export; the other export formats (e.g. CSV/Excel) are reviewed and reworked afterwards within this same spec. The current PDF is one huge table with a row per payslip part (every month and every correction), cut off after the bonus column and of little use to the reader. New PDF: first the "Gross per year" chart, then a small per-employer overview (employers newest to oldest) with a closing "Career total" column, then the "Monthly overview" and "All taxes and contributions per year" tables, both newest to oldest; all tables fully visible in landscape; German and English according to the UI language."

## Background

The Earnings domain (032) offers an export through the shared export capability (029). For the PDF format this currently produces a single wide table with one row per payslip part (regular payslip, correction, back-payment) and all of the stored figures. The table is wider than the page, so columns after "Bonus" are cut off, and it is far longer than a reader needs. The reader of an earnings PDF wants the same story the on-screen views tell: how gross income developed per year, what was earned per employer and in total, and where the money went in taxes and contributions.

This spec covers the rework of **all** earnings export formats in two phases. **Phase 1 (this iteration's scope for planning and implementation) is the PDF export.** The other formats (JSON/CSV/Excel, including the earnings part of the full "Export my data" archive) are not yet reviewed; they are listed as Phase 2 and will be specified in detail by amending this spec once the PDF is done.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - A PDF that tells the income story at a glance (Priority: P1)

A user opens the Earnings area and exports a PDF. The first thing they see after the title is the "Gross per year" chart, followed by a compact table showing each employer's totals and, in a final column, the total over their whole working life. Further on, they find the monthly overview and the table of all taxes and contributions per year.

**Why this priority**: This is the core value: the PDF becomes readable and useful, answering "how did my income develop and what have I earned in total" without scrolling through hundreds of payslip rows.

**Independent Test**: Export the PDF for a user with several employers and years of data; confirm the order of sections (chart → employer overview → monthly overview → taxes per year) and that the "Career total" figures equal the sum over all employers and all years.

**Acceptance Scenarios**:

1. **Given** a user with earnings data, **When** they export the PDF, **Then** the document shows, in this order: title/infobox, the "Gross per year" chart, the per-employer overview, the monthly overview, and the taxes-and-contributions-per-year table.
2. **Given** the PDF, **When** the user reads the per-employer overview, **Then** employers appear as columns from the most recent to the oldest and a closing "Career total" column shows the amounts summed over all employers and all years.
3. **Given** the PDF, **When** the user reads the monthly overview and the taxes-per-year table, **Then** years are listed from the newest (e.g. 2026) to the oldest (e.g. 2010).
4. **Given** the PDF, **When** the user looks for the former per-payslip-part table ("one row per payslip part"), **Then** it is no longer included.
5. **Given** the figures in the PDF, **When** compared with the on-screen overview, monthly breakdown and taxes-per-year views for the same data, **Then** the totals match.

---

### User Story 2 - Nothing is cut off in landscape (Priority: P1)

A user prints or reads the PDF. Every table fits the width of the landscape page with all its columns; no column is cropped, overlapping, or unreadably small. Tables that are longer than one page continue on the next page with their header repeated.

**Why this priority**: The cut-off table is the primary defect reported; the rework fails without it.

**Independent Test**: Export a PDF with the maximum realistic data volume (e.g. 15+ years, several employers, all columns populated with large amounts) and verify visually and by text extraction that every column header and value is fully present on the page.

**Acceptance Scenarios**:

1. **Given** any table in the PDF, **When** it is rendered, **Then** all of its columns are fully visible within the landscape page width.
2. **Given** a table that does not fit on the remaining space of a page, **When** it continues, **Then** it flows onto the next page and its header row is repeated.
3. **Given** very large amounts (e.g. six-figure yearly sums), **When** rendered, **Then** values are not truncated or wrapped mid-number.

---

### User Story 3 - The PDF follows the interface language (Priority: P2)

A user whose interface is set to German gets a fully German PDF (titles, column headers, number and date formats, explanatory text); a user with English gets a fully English one.

**Why this priority**: Required existing behavior that must not regress; lower than the layout work because it already works for the old PDF.

**Independent Test**: Export once with the UI in German and once in English; verify all texts, number formats (e.g. 1.234,56 € vs. €1,234.56) and the sort/summary labels are in the selected language.

**Acceptance Scenarios**:

1. **Given** the UI language is German, **When** the PDF is exported, **Then** all headings, column headers, the "Berufsleben gesamt" label, infobox text and number formats are German.
2. **Given** the UI language is English, **When** the PDF is exported, **Then** the same elements are English ("Career total") with English number formats.

---

### User Story 4 - Other export formats reworked (Priority: P3, Phase 2)

After the PDF is done, the remaining export formats of the earnings development are reviewed and reworked so that they are as useful as the new PDF for their purpose (e.g. machine-readable data for spreadsheets). Their concrete content is intentionally not defined yet.

**Why this priority**: Explicitly deferred by the product owner until the PDF is finished and the other formats have been assessed.

**Independent Test**: To be defined when this story is detailed; for now, only verifiable that the existing non-PDF exports keep working unchanged while Phase 1 is delivered.

**Acceptance Scenarios**:

1. **Given** Phase 1 is delivered, **When** a user exports any non-PDF format, **Then** the result is unchanged compared to before this feature.

---

### Edge Cases

- **No earnings data yet**: The PDF still generates with title and infobox and clearly shows empty states instead of empty chart/tables, consistent with the existing behavior for exports without data.
- **A single employer / a single year**: Overview and tables render correctly; the "Career total" equals that employer's total.
- **Employer with gaps** (years without income, or overlapping employers in the same year): Years/months without data are omitted or shown as empty/zero consistently with the on-screen views, with no misleading totals.
- **Corrections and back-payments**: They are included in the yearly/monthly figures exactly as the on-screen views count them, so PDF and screen agree even though individual correction rows are no longer listed.
- **Many years of data** (e.g. 2010–2026): Tables span multiple pages with repeated headers; nothing is cut off.
- **Dark mode in the app**: The PDF is always rendered for paper/light reading, regardless of the app's theme, including the chart.
- **Member without Earnings access**: Exporting still yields an empty result rather than an error, as today.
- **Long employer names**: They wrap within their cell instead of pushing columns off the page.
- **Language switched between exports**: Each export uses the language selected at the time of export.

## Requirements _(mandatory)_

### Functional Requirements

**PDF (Phase 1)**

- **FR-001**: The earnings PDF MUST present its content in this order: title and information box, the "Gross per year" chart, the per-employer overview table, the "Monthly overview" table, the "All taxes and contributions per year" table.
- **FR-002**: The "Gross per year" chart MUST show the same data as the on-screen chart of the same name and MUST be legible in the PDF (axis labels, values) regardless of the app's current theme.
- **FR-003**: The per-employer overview MUST show one column per employer, ordered from the most recent employer to the oldest, with one row per key figure (employment period, months employed, gross, bonus, taxes, social contributions, net, and the average gross per month employed).
- **FR-004**: The per-employer overview MUST end with a last column labelled "Career total" (DE: "Berufsleben gesamt") that sums each figure over all employers and all years of the user's data; for every summable figure the career total MUST equal the sum of the employer columns.
- **FR-005**: The "Monthly overview" and the "All taxes and contributions per year" tables MUST list years from newest to oldest.
- **FR-006**: The PDF MUST NOT contain the former table with one row per payslip part (regular payslip, correction, back-payment), and MUST NOT list source file names or the corrected-figure names.
- **FR-007**: Every table in the PDF MUST be fully visible on landscape pages: all columns present, no cropping, no overlapping text, values not truncated.
- **FR-008**: A table that spans more than one page MUST continue on the next page with its header row repeated.
- **FR-009**: All PDF texts (titles, headings, column headers, "Career total" label, infobox, footer, empty states) and number/date formats MUST follow the user's currently selected interface language, German or English.
- **FR-010**: All amounts in the PDF MUST be consistent with the figures shown on screen for the same data (same inclusion of corrections and back-payments, same rounding), and deductions MUST be shown as positive values, as in the current export.
- **FR-011**: The PDF MUST be producible with no data (empty states) and for a user without Earnings access (empty result, no error).
- **FR-012**: The rework MUST be limited to the earnings export; the PDF output of other features' exports (Holdings, Account Overview, Retirement, Insurances, Budget Planner, Historic Wealth Development) MUST remain unchanged.
- **FR-013**: The PDF MUST contain only the user's own data and MUST NOT disclose more data than the existing earnings export (no source file names, no document contents).

**Other formats (Phase 2, to be detailed)**

- **FR-014**: Until Phase 2 is specified and delivered, all non-PDF earnings export formats (including the earnings part of the full "Export my data" archive) MUST behave unchanged.
- **FR-015**: Once Phase 2 starts, the review and rework of the remaining formats MUST be captured by amending this spec before implementation.

### Key Entities

- **Employer overview column**: One employer with its totals for the key figures (gross, bonus, taxes, social contributions, net, average per month employed) over all periods of that employer; columns ordered newest employer first.
- **Career total**: The sum of each figure over all employers and all years; shown as the closing (last) column of the employer overview.
- **Yearly figures**: Per year (newest first) the monthly breakdown and the taxes/contributions, matching the on-screen "Monthly overview" and "All taxes and contributions per year" views.
- **Gross per year series**: One gross value per year, as plotted in the on-screen chart.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: In 100% of exports tested with realistic maximum data (15+ years, several employers), every column of every table is fully visible on its page; no cropped column or value.
- **SC-002**: A reader finds their total career gross income in the PDF within one page (the first page after the chart, without scrolling through monthly rows).
- **SC-003**: The PDF's page count for a 15-year history is at least 70% lower than the former per-payslip-part PDF for the same data.
- **SC-004**: For test data, 100% of totals in the PDF (per employer, career total, per year) equal the corresponding on-screen figures.
- **SC-005**: Exports in German and English contain no text in the other language and use the number format of the selected language.
- **SC-006**: Exports of every other feature and of non-PDF earnings formats are byte-for-byte or content-wise unchanged compared to before this feature (no regression).

## Assumptions

- The PDF uses the **same figures and groupings** as the on-screen "Gross per year", employer/career overview, "Monthly overview" and "All taxes and contributions per year" views; where the on-screen definition of a column exists, the PDF follows it.
- The per-employer overview has the key figures as rows and the employers as columns (the career total being the last column), mirroring the on-screen career summary; it shows a compact set of figures, not all stored ones.
- "Monthly overview" is the on-screen year × month table (years as rows, newest first; the twelve month columns stay in calendar order January–December, followed by the year sum). The PDF shows it for gross income, the on-screen default; other metrics are not part of the PDF.
- The tables always cover all of the user's data, independent of any employer filter currently set on screen.
- The PDF is always rendered in a light, print-friendly style, independent of the app theme.
- The full "Export my data" archive keeps using the same earnings export entry; its PDF is not part of the archive today and non-PDF contents are untouched in Phase 1.
- Changes to the shared PDF capability (029) must be backward compatible with all other features' exports.
- Phase 2 formats are not reviewed yet; their scope will be added by amending this spec.
- Existing entitlement/privacy rules for Earnings (owner-only data, no amounts in logs) apply unchanged.
