# Feature Specification: Altersvorsorge (Retirement Planning)

**Feature Branch**: `037-altersvorsorge-retirement-planning`

**Created**: 2026-10-03

**Status**: Draft

**Input**: User description: "Altersvorsorge-Feature (nur Deutschland; Nutzer sind in Deutschland wohnhaft, steuerpflichtig und rentenberechtigt). Ziel: Der Nutzer trägt in erster Linie alle Daten und Ansprüche zur künftigen Rentenphase ein, und diese werden übersichtlich dargestellt. Alle 3 Säulen müssen abbildbar sein: (1) gesetzliche Rente (Werte aus der Renteninformation der Deutschen Rentenversicherung), (2) betriebliche Altersvorsorge (mehrere Verträge, z.B. einer pro Arbeitgeber), (3) private Vorsorge (Riester-Rente, private Rentenversicherungen sowie ab 2027 das Altersvorsorgedepot als Unterpunkt). Zusätzlich ein Tab 'Weiterführende Informationen' mit je einer Card pro Art (Beschreibung + Link) zu DRV, Finanzfluss und Finanztip. Dashboard-Kachel mit erwartetem Rentenbeginn, Summe der monatlichen Garantierente und aktuellem monatlichem Ansparbetrag, sodass die Differenz zur erwarteten monatlichen Rente sichtbar wird."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Record all pension entitlements across the three pillars (Priority: P1)

A user opens the Retirement domain and records what they are entitled to. For the statutory pension the preferred route is uploading their Renteninformation document of the Deutsche Rentenversicherung, whose figures are read on the user's device and shown for review before saving; alternatively they type the figures in manually. Occupational pension contracts (one entry per former or current employer) and private provision contracts (Riester, private pension insurance) are entered manually. Each entry captures the contract's key figures, including the insurance or contract number the user needs to look the contract up — guaranteed and expected monthly pension, expected start of payout, current monthly contribution, and current value where applicable. Manually entered entries can be edited and deleted at any time; imported entries can be deleted or replaced by a newer import, but their figures cannot be edited by hand.

**Why this priority**: Capturing the data is the primary purpose of the feature; every other view depends on it. Even with only this story, users have a single structured place for their pension data.

**Independent Test**: Create one statutory pension record, two occupational contracts for different employers, and one Riester contract; reload the page and verify all four persist with their entered figures and can be edited and deleted.

**Acceptance Scenarios**:

1. **Given** a user with no retirement data, **When** they upload their Renteninformation document, **Then** the recognised figures (e.g. current entitlement, projected monthly pensions, statement date, insurance number) are shown for review, and after confirmation the statutory pillar shows them marked as "imported".
   - **Given** a document that cannot be recognised or whose figures contradict each other, **When** the upload finishes, **Then** it is rejected as a whole with an explanation and manual entry is offered; nothing is saved.
   - **Given** a user who prefers not to upload, **When** they enter the figures manually, **Then** the statutory pillar shows them marked as "manual".
   - **Given** an imported record, **When** the user opens it, **Then** its figures are read-only and only delete and "replace with a newer document" are offered.
   - **Given** a manual record, **When** the user edits it, **Then** the change is saved; **When** they later upload a document, **Then** they must confirm replacing the manual record.
2. **Given** an existing occupational contract with employer A, **When** the user adds a second contract for employer B, **Then** both are listed separately and their figures are summed in the pillar total.
3. **Given** a user adding a private contract, **When** they choose its type (Riester, private pension insurance, Altersvorsorgedepot), **Then** the form shows the fields relevant for that type and nothing the type cannot have.
4. **Given** an entry with an invalid value (negative amount, payout start before today's year minus an implausible range, missing required field), **When** the user saves, **Then** the save is rejected with a message naming the offending field.
5. **Given** any saved entry, **When** the user deletes it, **Then** it disappears from the overview and from all totals.

---

### User Story 2 - Clear overview of the retirement picture (Priority: P1)

The Retirement page shows a consolidated overview: per pillar a card with its contracts and totals, and an overall summary of expected monthly pension (guaranteed vs. expected), earliest/expected pension start, and total current monthly savings across all contracts. Where entries lack data (e.g. no statutory data entered yet), the overview shows a clear hint instead of silently using zero.

**Why this priority**: Presenting the data clearly is the second half of the stated goal; without it the entered data has little value.

**Independent Test**: With the data from Story 1, open the overview and verify per-pillar totals, the overall guaranteed and expected monthly pension, and the monthly savings sum are correct; remove all data of one pillar and verify the hint appears and the totals exclude it.

**Acceptance Scenarios**:

1. **Given** data in all three pillars, **When** the user opens the overview, **Then** each pillar shows its entries and sub-total, and the overall summary shows guaranteed monthly pension, expected monthly pension and total monthly savings.
2. **Given** only the statutory pillar is filled, **When** the user opens the overview, **Then** the occupational and private pillars show an empty state inviting the user to add a contract.
3. **Given** contracts with different payout start dates, **When** the overview is shown, **Then** it displays the expected pension start and indicates which contract(s) start earlier or later than it.
4. **Given** a contract whose figures stem from a statement dated more than 12 months ago, **When** the overview is shown, **Then** that entry is marked as potentially outdated.

---

### User Story 3 - Dashboard tile with the key retirement figures (Priority: P2)

The dashboard shows a Retirement tile with the expected pension start, the sum of the monthly guaranteed pension, the current monthly savings amount, and the expected total monthly pension, so the user sees at a glance how the guaranteed amount compares to the expected amount. The tile links to the Retirement page. With no data it shows an inviting empty state.

**Why this priority**: Valuable visibility but depends on Stories 1 and 2.

**Independent Test**: With data entered, open the dashboard and verify the tile's four figures match the overview; with no data, verify the empty state and that its call to action opens the Retirement page.

**Acceptance Scenarios**:

1. **Given** retirement data exists, **When** the user opens the dashboard, **Then** the tile shows expected pension start, guaranteed monthly pension sum, current monthly savings, and expected monthly pension, plus the difference between expected and guaranteed.
2. **Given** no retirement data, **When** the user opens the dashboard, **Then** the tile shows an empty state with a link to start entering data.
3. **Given** the user clicks the tile, **When** the navigation completes, **Then** the Retirement overview is shown.

---

### User Story 4 - Further information and external tools (Priority: P3)

A "Weiterführende Informationen" tab lists one card per topic/resource, each with a short description and an external link: the Deutsche Rentenversicherung page on the three pillars of retirement provision, the Finanzfluss pension-gap calculator, and the Finanztip pension-gap guide. Links open in a new browser tab and no user data is sent to the external site.

**Why this priority**: Helpful context, but independent of the user's own data.

**Independent Test**: Open the tab, verify three cards with description and link, and that each link opens the correct URL in a new tab.

**Acceptance Scenarios**:

1. **Given** the user opens the information tab, **When** it renders, **Then** one card per resource is shown with title, description, and link.
2. **Given** the user clicks a card's link, **When** the browser follows it, **Then** the external page opens in a new tab and Vaultfolio stays open.

---

### User Story 5 - Altersvorsorgedepot as a private provision type (Priority: P3)

From 2027, when the new Altersvorsorgedepot becomes available, users can record such a depot as a private provision entry beside their Riester contracts and private pension insurances. It is a depot rather than a guaranteed-payout contract, so it carries no guaranteed pension but a current value, monthly contribution, and optionally an expected monthly pension.

**Why this priority**: The product is not available before 2027; the data model must accommodate it, but it delivers value only later.

**Independent Test**: Add a private entry of type Altersvorsorgedepot, verify it contributes to monthly savings and current value but not to guaranteed pension.

**Acceptance Scenarios**:

1. **Given** the user adds a private entry of type Altersvorsorgedepot, **When** they save, **Then** it appears under the private pillar next to other private contracts.
2. **Given** such an entry with no guaranteed amount, **When** the overview is computed, **Then** the entry contributes to monthly savings and expected pension but contributes zero to guaranteed pension.

---

### Edge Cases

- A newer Renteninformation is uploaded while an imported record exists: after confirmation it replaces the older one.
- A user holds several contracts with the same employer or provider: each is its own entry; no deduplication.
- A contract is already paying out (pension in payment) or is paid-up (beitragsfrei): the monthly contribution is 0 and the entry remains valid.
- A contract has a one-time capital payout instead of monthly pension: the entry can record the capital amount; it is shown separately and not summed into monthly pension figures.
- Pension start dates differ between contracts (e.g. statutory at 67, occupational at 63): the overall expected start is the statutory regular start; earlier/later contract starts are flagged individually.
- Amounts that are projections vs. guaranteed figures are visibly distinguished everywhere they are shown, so projections are never presented as guarantees.
- Totals involve entries with missing optional figures: missing figures are excluded from sums and the entry is flagged as incomplete.
- Backend unavailable or encryption key missing: the Retirement domain reports unavailability and shows no partial or wrong figures.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The system MUST provide a Retirement area with an overview, one view per pillar (statutory, occupational, private), and a "Weiterführende Informationen" tab.
- **FR-002**: Users MUST be able to record the statutory pension either by uploading their Deutsche Rentenversicherung Renteninformation document (preferred, offered first) or by manual entry, with these figures, including the insurance number: statement date, pension-eligibility/regular retirement age or date, current monthly entitlement, projected monthly pension at regular retirement age (without further contributions), projected monthly pension with assumed continued contributions, and reduced-earning-capacity figures where printed.
- **FR-002a**: Every statutory record MUST carry its origin ("imported" or "manual"). Figures of an imported record MUST NOT be editable by the user; they can only be deleted or replaced by a newer import. Manual records MUST remain editable and deletable.
- **FR-002b**: A document import MUST show the recognised figures for review and require explicit confirmation before saving; unrecognised or inconsistent documents MUST be rejected as a whole, offering manual entry.
- **FR-002c**: Document interpretation MUST happen on the user's device; the document and its extracted text MUST NOT be sent to or stored by the server.
- **FR-003**: Users MUST be able to create, view, edit, and delete any number of occupational pension contracts, each with: employer/provider label, contract type (e.g. direct insurance, Pensionskasse, Direktzusage, Unterstützungskasse, Pensionsfonds), status (active, paid-up, in payout), guaranteed monthly pension, expected monthly pension, payout start, current monthly contribution (split into employee and employer share), current value, and statement date, and contract number.
- **FR-004**: Users MUST be able to create, view, edit, and delete any number of private provision contracts of type Riester, private pension insurance, or Altersvorsorgedepot, each with: provider label, status, guaranteed monthly pension, expected monthly pension, payout start, current monthly contribution, state subsidies per year (for Riester), current value, and statement date, and contract number.
- **FR-005**: The entry form MUST show only the fields that apply to the chosen contract type, and MUST distinguish guaranteed figures from projected figures.
- **FR-006**: The system MUST validate entries (non-negative amounts, plausible dates, required fields, consistent guaranteed ≤ expected) on the server, and reject invalid entries with a message identifying the field.
- **FR-007**: The overview MUST show per pillar its entries and sub-totals, and overall: total guaranteed monthly pension, total expected monthly pension, expected pension start, and total current monthly savings.
- **FR-008**: The overview MUST show an empty state for each pillar without entries, and MUST NOT silently treat missing data as zero in a way that suggests a complete picture; incomplete entries MUST be flagged.
- **FR-009**: Entries whose statement date is more than 12 months old MUST be marked as potentially outdated.
- **FR-010**: Capital payouts (one-time) MUST be recordable and shown separately from monthly pension sums.
- **FR-011**: The dashboard MUST show a Retirement tile with expected pension start, guaranteed monthly pension sum, current monthly savings, expected monthly pension and the difference between expected and guaranteed, with an empty state and a link to the Retirement area.
- **FR-012**: The "Weiterführende Informationen" tab MUST present one card per resource with title, description, and an external link opening in a new tab: Deutsche Rentenversicherung (three pillars of retirement provision), Finanzfluss (Rentenlückenrechner), Finanztip (Rentenlücke).
- **FR-013**: The feature MUST be scoped to the German retirement system; amounts are in euros and terminology follows German usage. No other countries' systems are supported.
- **FR-014**: Retirement data MUST be treated as sensitive personal data: every record is owned by exactly one user and visible/modifiable/deletable only by that user, monetary amounts are stored encrypted, the insurance number and contract numbers MAY be entered, stored (encrypted) and shown to the owner because the user needs them for look-ups, while name, address, tax ID and bank details are neither requested nor stored, and logs contain no amounts or identifiers.
- **FR-015**: Users MUST be able to delete a single entry and all of their retirement data, and the data MUST follow the account lifecycle of other owned data.
- **FR-016**: The Retirement area MUST explain in-app what is stored, that amounts are encrypted, and that the instance operator runs the server and holds the key.
- **FR-017**: The feature MUST NOT fetch data from any external pension provider or from the Deutsche Rentenversicherung; figures come only from the user's own entry or the user's own uploaded DRV document.
- **FR-018**: The user-facing text MUST be available in the app's supported languages, consistent with the rest of the application.
- **FR-019**: Retirement data MUST be included in the shared data export, consistent with other domains.

### Key Entities

- **Statutory pension record**: One per user. Statement date, regular retirement age/date, current entitlement, projected monthly pensions (without/with continued contributions), reduced-earning-capacity figures.
- **Occupational pension contract**: Many per user. Employer/provider label, contract type, status, guaranteed and expected monthly pension, payout start, employee/employer monthly contribution, current value, optional capital payout, statement date, contract number.
- **Private provision contract**: Many per user. Provider label, type (Riester, private pension insurance, Altersvorsorgedepot), status, guaranteed and expected monthly pension, payout start, monthly contribution, annual state subsidies (Riester), current value, optional capital payout, statement date, contract number.
- **Retirement summary** (derived): Per-pillar and overall totals — guaranteed monthly pension, expected monthly pension, expected pension start, current monthly savings, difference expected vs. guaranteed, flags for incomplete/outdated entries.
- **Information resource**: Title, description, external link, topic.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A user can record a complete set of provisions (one statutory record, two occupational and two private contracts) in under 15 minutes using only their paper statements.
- **SC-002**: A user can find their expected pension start, guaranteed monthly pension and monthly savings within 5 seconds of opening the dashboard.
- **SC-003**: In acceptance tests, 100% of overview and dashboard totals equal the sum of the entered per-entry figures.
- **SC-004**: 100% of projected figures are visibly distinguished from guaranteed figures wherever both appear.
- **SC-005**: No user can see, change, or delete another user's retirement data (verified by access tests, including administrators).
- **SC-006**: The information tab's three external links all open the intended page in a new tab, while no retirement data leaves the application.

## Assumptions

- All users live in Germany, are subject to German tax, and are entitled to German statutory pension; no other pension system is modelled.
- The DRV Renteninformation is imported from an uploaded document (preferred) or typed in manually. Occupational and private contracts are entered manually in this feature; document import for them can follow once sample documents are analysed.
- "Upload" means the user selects a document in the app; it is interpreted on the device under the constitution's on-device-only, deterministic, no-external-service rules (including consent-based on-device text recognition for scans). The document itself is never stored.
- The constitution's rule against storing insurance/contract numbers is deliberately relaxed for this domain (owner-only, encrypted at rest); it needs a matching amendment.
- The Altersvorsorgedepot is modelled as a private contract type with generic fields (value, monthly contribution, optional expected pension); its detailed legal rules (subsidies, payout phases) are not calculated and can be refined once the product is available in 2027. The type may be offered in the UI before then.
- Displayed pensions are gross nominal amounts as printed on the statements; the feature performs no tax, inflation, or health-insurance-contribution calculations and no pension-gap computation (it links to external calculators instead).
- The Retirement domain already exists as a registered placeholder and is replaced by this feature's content; the domain follows the same sensitive-data rules as Earnings.
- The constitution's Product Scope lists Retirement as a planned domain; this feature fulfils that entry and the constitution's In Scope section should be updated accordingly.
- The external resource list is static content maintained by the project, not editable by users.
