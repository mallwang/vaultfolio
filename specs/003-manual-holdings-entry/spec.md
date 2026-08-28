# Feature Specification: Manual Holdings Entry

**Feature Branch**: `003-manual-holdings-entry`

**Created**: 2026-08-28

**Status**: Draft

**Design**: [design.md](./design.md) — approved UX review mockup of the holdings list, add/edit
form, and delete confirmation

**Input**: User description: "Enable users to manually input their portfolio holdings. A holding has an asset type (ETF, Share, Gold, or Bitcoin), a quantity of units held, a purchase price, and a purchase date. ETF and Share holdings additionally require an ISIN and a name; Gold holdings require weight/purity (or troy ounces); Bitcoin holdings require only the quantity. Each purchase is recorded as its own separate lot/entry (no automatic merging of repeated purchases of the same asset) so per-lot cost basis is preserved. All amounts and prices are entered and stored in a single base currency for now (no multi-currency support yet). Users can add, edit, and delete holdings. This feature is manual data entry only — it does not include importing holdings or looking up live market prices; those are separate future features. This holdings management screen lives under the existing "Holdings" navigation area scaffolded in the app shell."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Record a New Holding (Priority: P1)

As a Vaultfolio user, I want to manually add a holding — choosing its asset type and entering the
type-appropriate details (quantity, purchase price, purchase date, plus any type-specific
identifiers) — so that my portfolio reflects an asset I actually own.

**Why this priority**: This is the foundational capability. Without the ability to add a holding,
the Holdings area has no data and every other capability (viewing, editing, deleting) has nothing
to act on.

**Independent Test**: Can be fully tested by opening the Holdings area, adding one holding of each
asset type with valid data, and confirming each appears in the holdings list with the details
entered.

**Acceptance Scenarios**:

1. **Given** the user is on the Holdings area, **When** they choose to add a new holding and
   select asset type "ETF", **Then** the form requests ISIN, name, quantity, and purchase price as
   required fields, and purchase date as an optional field, and saving with valid values creates a
   new holding entry visible in the list.
2. **Given** the user is adding a holding, **When** they select asset type "Share", **Then** the
   form requests the same fields as ETF (ISIN, name, quantity, purchase price, optional purchase
   date).
3. **Given** the user is adding a holding, **When** they select asset type "Gold", **Then** the
   form requests weight (with a unit, e.g. troy ounces or grams) and purity, plus quantity,
   purchase price, and optional purchase date, and does not request an ISIN.
4. **Given** the user is adding a holding, **When** they select asset type "Bitcoin", **Then** the
   form requests only quantity, purchase price, and optional purchase date, with no ISIN or
   weight/purity fields.
5. **Given** the user is adding or editing a holding, **When** they leave purchase date empty,
   **Then** the holding saves successfully, recording only the current quantity and price without
   a dated acquisition point.
6. **Given** the user has filled the form with valid data, **When** they submit it, **Then** the
   holding is saved as its own entry and appears in the holdings list without altering any
   previously saved holding.
7. **Given** the user leaves a required field empty or enters an invalid value (e.g. negative
   quantity, negative price, or a purchase date in the future when one is provided), **When** they
   attempt to submit, **Then** the system blocks submission and shows a clear validation message
   identifying the problem.

---

### User Story 2 - Review My Holdings (Priority: P1)

As a Vaultfolio user, I want to see all the holdings I have entered, with their key details, so I
can confirm my portfolio data is accurate and complete.

**Why this priority**: Entering data has no value unless the user can see and verify it. This is
the read counterpart that makes Story 1 useful and is a prerequisite for editing/deleting.

**Independent Test**: Can be fully tested by adding several holdings across different asset types
and confirming the Holdings list displays each one with its asset type, quantity, purchase price,
purchase date, and type-specific identifiers.

**Acceptance Scenarios**:

1. **Given** one or more holdings have been added, **When** the user opens the Holdings area,
   **Then** they see a list of all holdings showing asset type, name/identifier (where
   applicable), quantity, purchase price, and purchase date (or a clear indicator, e.g. "—", when
   no purchase date was recorded).
2. **Given** the user has added two separate lots of the same asset (e.g. two purchases of the
   same ETF on different dates), **When** they view the holdings list, **Then** both lots are
   shown as distinct entries, not merged into one.
3. **Given** no holdings have been added yet, **When** the user opens the Holdings area, **Then**
   they see a clear empty state inviting them to add their first holding, rather than a blank or
   broken screen.

---

### User Story 3 - Correct a Mistake (Priority: P2)

As a Vaultfolio user, I want to edit an existing holding's details, so I can fix data entry
mistakes (e.g. wrong quantity or purchase date) without deleting and re-creating the entry.

**Why this priority**: Important for data quality and user trust, but the product remains usable
without it in the short term since a mistaken entry can be deleted and re-added (Story 4) as a
workaround.

**Independent Test**: Can be fully tested by adding a holding, editing one or more of its fields,
saving, and confirming the list reflects the updated values while leaving other holdings
unchanged.

**Acceptance Scenarios**:

1. **Given** an existing holding, **When** the user opens it for editing and changes a field (e.g.
   quantity), **Then** saving updates that holding's value in the list without creating a
   duplicate entry.
2. **Given** the user edits a holding and enters an invalid value, **When** they attempt to save,
   **Then** the same validation rules as creation apply and the invalid save is blocked with a
   clear message.
3. **Given** the user is editing a holding, **When** they cancel the edit, **Then** the holding
   retains its original values unchanged.

---

### User Story 4 - Remove a Holding (Priority: P2)

As a Vaultfolio user, I want to delete a holding I no longer want tracked (e.g. it was entered by
mistake or the asset was fully sold), so my portfolio only reflects what I intend to track.

**Why this priority**: Necessary for data hygiene and correcting mistakes, but less frequently
used than adding/viewing, and the product is still usable for its core purpose without it
initially.

**Independent Test**: Can be fully tested by adding a holding, deleting it, and confirming it no
longer appears in the holdings list while other holdings remain untouched.

**Acceptance Scenarios**:

1. **Given** an existing holding, **When** the user chooses to delete it and confirms, **Then** it
   is removed from the holdings list and no longer counted anywhere in the app.
2. **Given** the user starts deleting a holding, **When** they are prompted to confirm, **Then**
   declining the confirmation leaves the holding unchanged in the list.

---

### Edge Cases

- What happens when a user selects an asset type, partially fills the type-specific fields, then
  switches to a different asset type? The form MUST discard/reset fields that don't apply to the
  newly selected type rather than silently submitting stale values.
- What happens when a Gold holding's weight and purity are both required but the user knows only
  one? The system MUST require both, since neither alone identifies the value of a gold holding
  consistently.
- How does the system handle a purchase date in the future? If a purchase date is provided, a
  future date MUST be rejected as invalid; leaving the field empty is always valid.
- What happens when a user only knows what they currently hold and not when or at what price they
  acquired it? Purchase date MUST be optional, so the holding can be recorded with just quantity
  and asset-type fields; purchase price remains required as the best available cost reference even
  when the acquisition date is unknown.
- How does the system handle a quantity or purchase price of zero or negative? Both MUST be
  rejected as invalid (a holding must represent a real, positive amount acquired at a real,
  non-negative cost).
- What happens when the user has many holdings (e.g. dozens of lots across several assets)? The
  list MUST remain usable (e.g. scrollable, ideally sortable/filterable) rather than degrading.
- What happens when the user attempts to delete a holding that has already been removed in another
  browser tab/session? The system MUST handle this gracefully (e.g. informative message) rather
  than erroring unrecoverably.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The system MUST allow a user to add a new holding by selecting one of four asset
  types: ETF, Share, Gold, or Bitcoin.
- **FR-002**: The system MUST require, for every holding regardless of asset type: quantity and
  purchase price. Purchase date MUST be optional, so a user who only wants to record what they
  currently hold — without caring about historic performance — can omit it.
- **FR-003**: The system MUST additionally require an ISIN and a name for holdings of type ETF or
  Share.
- **FR-004**: The system MUST additionally require weight (with unit) and purity for holdings of
  type Gold.
- **FR-005**: The system MUST NOT require an ISIN, name, or weight/purity for holdings of type
  Bitcoin — quantity and purchase price are sufficient.
- **FR-006**: The system MUST present only the fields relevant to the currently selected asset
  type, hiding or omitting fields that do not apply — including when editing an existing holding,
  where only the fields for that holding's own asset type are shown (e.g. no weight/purity fields
  when editing a Bitcoin holding).
- **FR-007**: The system MUST validate that quantity and purchase price are positive numbers, and,
  when a purchase date is provided, that it is not in the future; it MUST block submission with a
  clear message otherwise.
- **FR-008**: The system MUST validate that ISIN (when required) conforms to a well-formed ISIN
  format before allowing submission.
- **FR-009**: The system MUST save each add-holding submission as its own independent entry
  ("lot"), even when an entry with the same asset type and identifier already exists — it MUST NOT
  automatically merge or average quantities/prices across entries.
- **FR-010**: The system MUST display all of a user's holdings in a list, showing at minimum:
  asset type, identifying label (name/ISIN for ETF/Share, "Gold" with weight/purity, or "Bitcoin"),
  quantity, purchase price, and purchase date (or a clear indicator that none was recorded).
- **FR-011**: The system MUST show a clear empty state when the user has no holdings yet, distinct
  from a loading or error state.
- **FR-012**: The system MUST allow a user to edit an existing holding's fields and persist the
  change, using the same field set (per FR-006, scoped to that holding's asset type) and
  validation rules as creation.
- **FR-013**: The system MUST allow a user to cancel an in-progress edit without altering the
  holding's stored values.
- **FR-014**: The system MUST allow a user to delete an existing holding, after an explicit
  confirmation step, permanently removing it from their holdings list.
- **FR-015**: The system MUST treat all monetary amounts (purchase price) as being in a single,
  implicit base currency; the system does not collect or store a currency per holding at this
  time.
- **FR-016**: The system MUST NOT perform any external market-data lookups, price fetching, or
  import operations as part of adding, editing, or viewing holdings — all values are user-supplied.
- **FR-017**: The system MUST persist added, edited, and deleted holdings so they remain accurate
  across sessions (e.g. reloading the app or returning later shows the current state).

### Key Entities

- **Holding**: A single lot representing one purchase (or current position) of one asset owned by
  the user. Common attributes: asset type (ETF, Share, Gold, or Bitcoin), quantity, purchase price
  (required), purchase date (optional — omitted when the user only wants to record what they
  currently hold). Type-specific attributes: ISIN and name (ETF/Share only), weight and purity
  (Gold only). Each Holding is independent — repeated purchases of the same underlying asset
  produce multiple Holding entries rather than updating one.
- **Asset Type**: A fixed classification (ETF, Share, Gold, Bitcoin) that determines which
  additional fields a Holding requires and how it is labeled in the holdings list.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A user can add a new holding of any of the four asset types, from opening the "add
  holding" action to seeing it appear in the list, in under 1 minute.
- **SC-002**: 100% of holdings entered with invalid data (negative quantity/price, a future date
  when one is provided, malformed ISIN, missing required type-specific field) are rejected with a
  clear, specific validation message before being saved.
- **SC-003**: A user can locate and confirm the details of any previously entered holding within
  the holdings list without needing to consult any source outside the application.
- **SC-004**: A user can correct a mistaken holding (via edit or delete-and-recreate) and see the
  corrected state reflected immediately, with zero impact on the accuracy of any other holding.
- **SC-005**: Repeated purchases of the same asset always result in the same number of visible lots
  as the number of times the user added a holding for that asset — zero unintended merges.
- **SC-006**: Holdings entered in one session remain fully intact (same values, same count) when
  the user returns in a later session.

## Assumptions

- "Base currency" is a single, application-wide currency (not configurable per holding in this
  feature); currency configuration and multi-currency support are out of scope and may be
  addressed by a future feature.
- Current market value, unrealized gain/loss, and portfolio-level valuation are out of scope for
  this feature — this feature covers only recording what was bought, at what price, and
  optionally when. Computing current value requires live market prices, which are explicitly
  excluded here. Purchase price and date are captured now so that valuation/P&L features can be
  built later without re-collecting data; a holding saved without a purchase date can still be
  valued at today's price by a future feature, it just won't support a time-based P&L view for
  that lot.
- Weight unit for Gold defaults to troy ounces or grams (a single system-defined unit); supporting
  multiple selectable weight units is a reasonable future enhancement, not required now.
  Purity is expected as a standard fineness value (e.g. 999.9, 24k) without further validation of
  real-world plausibility beyond being a positive number.
- ISIN format validation follows the standard 12-character (2-letter country code + 9 alphanumeric
  - 1 check digit) structure; this feature validates format/shape, not that the ISIN corresponds to
    a real, currently-tradable security.
- No user authentication/multi-user separation is assumed beyond what the existing application
  already provides; holdings are scoped to whatever user/session boundary the application already
  establishes.
- Deleting a holding is a hard delete (no soft-delete/undo/recovery) for this feature; undo history
  is a possible future enhancement.
- This feature builds on the "Holdings" navigation area already scaffolded in
  [002-primeng-app-structure](../002-primeng-app-structure/spec.md) and replaces its placeholder
  "coming soon" state with real functionality.
