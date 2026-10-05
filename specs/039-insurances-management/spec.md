# Feature Specification: Insurances Management

**Feature Branch**: `039-insurances-management`

**Created**: 2026-10-05

**Status**: Draft

**Design**: [design.md](./design.md)

**Input**: User description: "Implement the insurances feature: users manage all of their personal insurances including monthly/quarterly/yearly premium, contract data, cancellation deadlines etc. (e.g. private liability, household contents, disability, car, travel health, statutory health). Catalog of many insurance types, some sensible, some combination products, some only sensible in specific situations (e.g. natural-hazard cover only for property owners). Statutory health insurance is coupled to Earnings when available, otherwise entered manually — analogous for other social insurances. Reminder emails (user-toggleable) for deadlines. Gap check in v1. No document upload. Only the user themself is insured. UI comparable to Retirement, Wealth and Earnings."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Record and manage insurance contracts (Priority: P1)

A user opens the Insurances area and records each of their private insurances (e.g. private liability, household contents, disability, car, travel health) by choosing an insurance type from a catalog and entering contract data: insurer, contract number, start date, optional end date, premium amount with payment interval (monthly, quarterly, half-yearly, yearly), cancellation period, automatic renewal, coverage details (e.g. coverage sum, deductible) and free notes. The user can edit, deactivate (cancelled/ended) and delete contracts.

**Why this priority**: Without contract records nothing else in the feature has value; this alone replaces the user's spreadsheet or folder of papers.

**Independent Test**: Create a household contents contract with a yearly premium, reopen the area, see it in the list with correct data, edit the premium, then delete it.

**Acceptance Scenarios**:

1. **Given** no contracts, **When** the user adds a contract of type "Private liability" with premium 96 EUR yearly, **Then** it appears in the list with its monthly equivalent (8.00 EUR) and yearly cost (96.00 EUR).
2. **Given** an existing contract, **When** the user changes the premium or payment interval, **Then** all totals and charts reflect the change.
3. **Given** an existing contract, **When** the user marks it as cancelled with an end date, **Then** it is excluded from current cost totals after that date and remains visible in an "inactive" filter.
4. **Given** the user's data, **When** another user signs in, **Then** they never see these contracts.

---

### User Story 2 - Cost overview and charts (Priority: P1)

The user sees a summary like the Retirement/Wealth/Earnings areas: total insurance cost per month and per year, number of active contracts, cost distribution by insurance group (e.g. persons, liability, property, mobility, legal), and a month-by-month view showing when premiums are actually paid (so that yearly premiums appear as spikes).

**Why this priority**: Understanding total cost and its distribution is the main insight beyond a plain list.

**Independent Test**: With three contracts of different intervals, verify monthly/yearly totals, distribution chart and the payment timeline against hand-calculated values.

**Acceptance Scenarios**:

1. **Given** contracts with monthly, quarterly and yearly premiums, **When** the user opens the overview, **Then** totals are normalized correctly to monthly and yearly values.
2. **Given** a yearly premium due in March, **When** the user views the payment timeline, **Then** the full amount appears in March.
3. **Given** no active contracts, **When** the user opens the overview, **Then** an empty state guides them to add the first contract.

---

### User Story 3 - Cancellation deadlines (Priority: P1)

For every contract the system derives the next possible cancellation date from contract data (end of term, cancellation period, renewal behaviour, optional fixed cancellation date such as 30 November for car insurance) and shows it in the list and in an upcoming-deadlines section. Contracts whose deadline is close are highlighted.

**Why this priority**: Missing a cancellation deadline is the most expensive mistake in managing insurances; it is the core value of tracking contract data.

**Independent Test**: Create a contract with a three-month cancellation period and a term ending on 31 December; verify the derived "cancel by" date is 30 September and highlighting appears within the warning window.

**Acceptance Scenarios**:

1. **Given** a contract with auto-renewal and a fixed yearly term end, **When** the term end passes without cancellation, **Then** the next cancellation date moves to the following term.
2. **Given** a contract without auto-renewal and with an end date, **When** the user views it, **Then** it is shown as "ends on <date>" and no cancellation date is demanded.
3. **Given** a cancellation deadline within the warning window, **When** the user opens the overview, **Then** the contract is highlighted in the upcoming-deadlines section.

---

### User Story 4 - Reminder emails (Priority: P2)

The user can switch email reminders for cancellation deadlines on or off (globally and optionally per contract) and choose how many days in advance they are reminded. When enabled and a deadline is within the lead time, one reminder email is sent in the user's language. Reminders are never sent when disabled, for inactive contracts, or repeatedly for the same deadline.

**Why this priority**: High value, but the feature is already usable without it.

**Independent Test**: Enable reminders with a lead time of 30 days, create a contract whose deadline is 20 days away, and verify exactly one email is produced; disable reminders and verify none is.

**Acceptance Scenarios**:

1. **Given** reminders enabled and a deadline inside the lead time, **When** the daily reminder check runs, **Then** the user receives exactly one email for that deadline.
2. **Given** reminders disabled (globally or for that contract), **When** the check runs, **Then** no email is sent.
3. **Given** a reminder was already sent for a deadline, **When** the check runs again, **Then** no duplicate is sent; after the deadline renews, a new reminder can be sent.
4. **Given** the user changed their language, **When** a reminder is sent, **Then** it uses that language.

---

### User Story 5 - Social insurances linked to Earnings (Priority: P2)

Statutory social insurances (health, long-term care, pension, unemployment) appear as read-only entries whose contributions are taken from the user's Earnings data when payslips exist. If no Earnings data exists, or the user prefers, they can enter these contributions manually (e.g. self-employed, voluntarily insured, pensioners). The source of each figure ("from Earnings" or "manual") is visible.

**Why this priority**: Gives a complete cost picture without double entry, but private contracts deliver value without it.

**Independent Test**: With Earnings payslips present, verify the statutory health entry shows the employee contribution from the latest payslip and is marked as coming from Earnings; without payslips, verify manual entry works.

**Acceptance Scenarios**:

1. **Given** Earnings payslips exist, **When** the user opens Insurances, **Then** statutory health, care, pension and unemployment show the current employee contribution and are marked "from Earnings".
2. **Given** no Earnings data (or Earnings not available to the user), **When** the user opens Insurances, **Then** they can add these statutory insurances manually with a premium and interval.
3. **Given** a linked entry, **When** a newer payslip is imported, **Then** the displayed contribution updates automatically without user action.
4. **Given** a linked entry, **When** the user chooses manual entry instead, **Then** their manual value is used and the Earnings value is ignored.

---

### User Story 6 - Gap check (Priority: P2)

The user answers a short profile (e.g. owns real estate, owns a car, has children, has pets, is self-employed, travels abroad, is employed/self-employed/civil servant). Based on the profile and the catalog's classification (essential, recommended, situational, combination/optional), the system shows which relevant insurances are missing, which are covered, and which recorded contracts are likely redundant (e.g. a combination product overlapping another contract). The user can dismiss a suggestion ("not needed") so it is no longer reported.

**Why this priority**: Differentiating insight, but depends on contracts and the catalog.

**Independent Test**: Set profile "owns real estate" without an elemental-damage contract and verify it is reported as missing; add the contract and verify it turns to "covered".

**Acceptance Scenarios**:

1. **Given** the profile says the user owns real estate and no natural-hazard contract exists, **When** the user opens the gap check, **Then** that insurance is listed as recommended-but-missing with a short explanation.
2. **Given** the profile says the user has no car, **When** the gap check runs, **Then** car insurance is not reported as missing.
3. **Given** an essential insurance (e.g. private liability) is missing, **When** the gap check runs, **Then** it is highlighted more prominently than situational suggestions.
4. **Given** the user dismisses a suggestion, **When** the gap check runs again, **Then** it is not reported until the user restores it.
5. **Given** the gap check output, **Then** it is presented as general guidance, not as personalized insurance advice.

---

### Edge Cases

- Contract without end date and without auto-renewal: treated as open-ended; cancellation date computed from the cancellation period only.
- Premium interval changes mid-term or premium adjustments by the insurer: user edits the premium; history is not required in v1.
- Contracts that start in the future or ended in the past: excluded from current totals accordingly.
- Linked statutory figures when the latest payslip is old or missing for recent months: the most recent available payslip is used and its date is shown.
- Earnings feature disabled by the administrator or user has no Earnings access: statutory entries fall back to manual.
- Cancellation deadline falls on a weekend/holiday: shown as the calculated date; no business-day adjustment in v1.
- Contract is deleted or deactivated after a reminder was scheduled: no reminder is sent.
- Catalog types not fitting the user's situation: user may still record any type; a "Other" type is available.
- Invalid input (negative premium, end before start, missing required fields): rejected with clear messages.
- Premium of a combination product that covers several catalog types: the contract can be assigned to one primary type plus additional covered types so the gap check does not report those as missing.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: Users MUST be able to create, view, edit, deactivate and delete insurance contracts for themselves; contracts are private to the owning user.
- **FR-002**: Each contract MUST capture: insurance type (from catalog), name, insurer, contract number, start date, optional end date, premium amount, payment interval (monthly, quarterly, half-yearly, yearly), payment month for non-monthly intervals, cancellation period (value and unit), automatic renewal, optional fixed cancellation date (day/month), status, and free-text notes.
- **FR-003**: Contracts MUST support type-specific optional details (at least: coverage sum, deductible; for car: licence plate and no-claims class; for disability: insured monthly benefit; for household contents: insured sum).
- **FR-004**: The system MUST provide an insurance type catalog grouped by area (persons, liability, property, mobility, legal, other) covering at minimum: private liability, household contents, residential building, natural-hazard (elemental), disability, term life, accident, statutory health, private health, supplementary health, travel health, dental supplement, long-term care, car, bicycle, pet liability, legal protection, property-owner liability, and "Other".
- **FR-005**: Each catalog type MUST carry a classification (essential, recommended, situational, combination/optional) and, where applicable, applicability conditions tied to the user's profile (e.g. owns real estate, owns a car).
- **FR-006**: The system MUST normalize premiums to monthly and yearly cost for all intervals and show total monthly and yearly cost of all active contracts.
- **FR-007**: The system MUST show cost distribution by insurance group and a month-by-month payment timeline for the selected year.
- **FR-008**: The system MUST derive the next possible cancellation date per contract from term, cancellation period, renewal behaviour and optional fixed cancellation date, and highlight contracts whose deadline lies within a warning window.
- **FR-009**: The list MUST be filterable by group, status and classification and sortable by premium and next cancellation date.
- **FR-010**: Users MUST be able to enable or disable cancellation-deadline reminder emails globally and per contract, and set the lead time in days; the default for new users MUST be disabled.
- **FR-011**: When enabled, the system MUST send at most one reminder email per contract and deadline, in the user's language, and MUST NOT send reminders for inactive or deleted contracts.
- **FR-012**: Statutory social insurances (health, long-term care, pension, unemployment) MUST be representable as entries whose contribution is taken from Earnings data when available, showing the data source and date; users MUST be able to override with manual values and MUST be able to enter them manually when no Earnings data exists.
- **FR-013**: Linked statutory entries MUST be read-only unless the user switches them to manual, and MUST NOT lead to double counting in totals.
- **FR-014**: Users MUST be able to maintain a short insurance profile used by the gap check.
- **FR-015**: The gap check MUST list missing relevant insurances, covered ones, and possibly redundant contracts, grouped by classification, each with a brief explanation, and allow dismissing a suggestion and restoring it.
- **FR-016**: Gap check results MUST be labelled as general guidance and not as insurance advice.
- **FR-017**: Insurances MUST integrate with existing platform features: navigation entry and dashboard widget of the Insurances area, data export, English and German localisation, light/dark theme.
- **FR-018**: Input MUST be validated (non-negative premium, end date not before start date, required fields) with clear error messages.
- **FR-019**: Documents or file attachments are out of scope; users can only store notes.

### Key Entities _(include if feature involves data)_

- **Insurance Type**: Catalog entry with group, classification and applicability conditions; may be marked as covered by combination products.
- **Insurance Contract**: A user's contract of a given type with insurer, term, premium, interval, cancellation settings, status, details and reminder setting.
- **Premium Schedule (derived)**: Normalized monthly/yearly cost and payment months derived from a contract.
- **Cancellation Deadline (derived)**: Next possible cancellation date derived from contract term data.
- **Social Insurance Entry**: Statutory insurance contribution with a source (Earnings or manual) and date.
- **Insurance Profile**: The user's situation flags (e.g. owns real estate, owns a car, has children/pets, employment status, travels abroad) used by the gap check.
- **Gap Suggestion Dismissal**: The user's decision to hide a catalog type from gap reporting.
- **Reminder Settings / Reminder Log**: User's reminder preferences and a record of reminders already sent per contract deadline.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A user can record a complete insurance contract in under 2 minutes.
- **SC-002**: Monthly and yearly cost totals match hand-calculated values for 100% of tested interval combinations (monthly, quarterly, half-yearly, yearly).
- **SC-003**: For 100% of tested contract configurations, the derived cancellation date equals the manually calculated date.
- **SC-004**: With reminders enabled, 100% of deadlines inside the lead time trigger exactly one email, and with reminders disabled none are sent.
- **SC-005**: For users with Earnings data, statutory contributions appear without any manual entry, and totals never count a contribution twice.
- **SC-006**: The gap check correctly reports missing, covered and not-applicable insurances for all documented profile/contract test combinations.
- **SC-007**: Within the first session, a user with six contracts can identify their total yearly insurance cost and the next cancellation deadline within 10 seconds of opening the area.

## Assumptions

- Only the signed-in user is insured; no family members or third-party insured persons in v1.
- The existing "Insurances" placeholder area (navigation entry, route, dashboard scope, export extension point) is the home of this feature.
- Premiums are entered in EUR (the application's currency) and are gross amounts including insurance tax.
- Earnings coupling uses the employee share of health, care, pension and unemployment contributions from the latest available payslip; employer shares are not counted as the user's cost.
- Statutory accident insurance (paid by employers) is out of scope.
- Pension contributions shown under statutory insurances are informational cost lines and are not merged with the Retirement area's data.
- Reminder emails reuse the existing notification and localisation infrastructure; reminder checks run once per day.
- Default reminder lead time is 30 days; default warning window for highlighting equals the user's lead time (30 days if reminders are off).
- The catalog and its classifications are maintained with the application, not editable by users in v1; users can use "Other" for uncovered types.
- No document upload, no premium history, no claims tracking, no automatic comparison of offers, and no business-day adjustment of deadlines in v1.
- Gap check recommendations are informational and based on generally accepted German insurance guidance.
