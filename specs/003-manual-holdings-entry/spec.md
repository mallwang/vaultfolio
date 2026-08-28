# Feature Specification: Manual Holdings Entry

**Feature Branch**: `003-manual-holdings-entry`

**Created**: 2026-08-28

**Status**: Draft

**Design**: [design.md](./design.md) — approved UX review mockup of the holdings list, add/edit
form, and delete confirmation

**Input**: User description: "Enable users to manually input their portfolio holdings. A holding has an asset type (ETF, Share, Gold, or Bitcoin), a quantity of units held, a purchase price, and a purchase date. ETF and Share holdings additionally require an ISIN and a name; Gold holdings require weight/purity (or troy ounces); Bitcoin holdings require only the quantity. Each purchase is recorded as its own separate lot/entry (no automatic merging of repeated purchases of the same asset) so per-lot cost basis is preserved. All amounts and prices are entered and stored in a single base currency for now (no multi-currency support yet). Users can add, edit, and delete holdings. This feature is manual data entry only — it does not include importing holdings or looking up live market prices; those are separate future features. This holdings management screen lives under the existing "Holdings" navigation area scaffolded in the app shell."

## Clarifications

### Session 2026-08-28

- Q: For ETF and Gold holdings, should adding the same asset again update one existing row (new quantity/average price replacing the old), or still create a new separate lot entry like Shares/Bitcoin do? → A: Add a required "Management" field (free text, e.g. Private, Roboadvisor, a bank name) to every holding. Within the same asset identifier + Management source, repeat entries for ETF/Gold update the existing row instead of creating a new lot. Shares and Bitcoin continue to record each purchase as its own separate lot regardless of Management, so the same ISIN can appear once under "Roboadvisor" (single updated row) and again under "Private" (its own lot history), for example.
- Q: Since Gold holdings have no purchase price at all, how should Gold be represented in the "asset distribution by relative total price" view? → A: Allow an optional, editable current value (or price-per-gram) field on Gold holdings, used only for the distribution view — distinct from purchase price/date, which Gold does not have.
- Q: For ETF/roboadvisor holdings, is the average purchase price a required field or optional? → A: Required, same as Shares/Bitcoin.
- Q: Does Gold still need separate weight (with unit) and purity fields? → A: Collapses to a single required weight field in grams (no unit selector, no purity field); the user converts other units (e.g. troy ounces) to grams themselves before entry.
- Q: Does the Management field apply to all four asset types, or only ETF/Gold? → A: Universal — every holding of every asset type requires a Management value (free text, not a fixed enum), even though it will typically be "Private" for Shares/Bitcoin.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Record a New Holding (Priority: P1)

As a Vaultfolio user, I want to manually add a holding — choosing its asset type and entering the
type-appropriate details (quantity, price, date, management source, plus any type-specific
identifiers) — so that my portfolio reflects an asset I actually own.

**Why this priority**: This is the foundational capability. Without the ability to add a holding,
the Holdings area has no data and every other capability (viewing, editing, deleting) has nothing
to act on.

**Independent Test**: Can be fully tested by opening the Holdings area, adding one holding of each
asset type with valid data, and confirming each appears in the holdings list with the details
entered.

**Acceptance Scenarios**:

1. **Given** the user is on the Holdings area, **When** they choose to add a new holding and
   select asset type "ETF", **Then** the form requests ISIN, name, quantity, average purchase
   price, and management source as required fields, presents no purchase date field at all, and
   saving with valid values creates a new holding entry visible in the list — or, if a holding
   already exists for that ISIN under the same management source, updates that existing entry's
   quantity and average price instead of creating a duplicate.
2. **Given** the user is adding a holding, **When** they select asset type "Share", **Then** the
   form requests ISIN, name, quantity, purchase price, and management source as required fields,
   plus purchase date as an optional field, and saving always creates a new, independent lot entry
   regardless of whether a holding with the same ISIN already exists.
3. **Given** the user is adding a holding, **When** they select asset type "Gold", **Then** the
   form requests weight in grams and management source as required fields, an optional current
   value (or price-per-gram) field for the distribution view, and no ISIN, name, purchase price,
   or purchase date, and saving with valid values creates a new holding entry — or, if a Gold
   holding already exists under the same management source, updates that existing entry's weight
   instead of creating a duplicate.
4. **Given** the user is adding a holding, **When** they select asset type "Bitcoin", **Then** the
   form requests quantity, purchase price, and management source as required fields, plus purchase
   date as an optional field, with no ISIN, name, or weight fields, and saving always creates a
   new, independent lot entry.
5. **Given** the user is adding or editing a Share or Bitcoin holding, **When** they leave purchase
   date empty, **Then** the holding saves successfully, recording only the current quantity and
   price without a dated acquisition point.
6. **Given** the user has filled the form with valid data for a Share or Bitcoin holding, **When**
   they submit it, **Then** the holding is saved as its own new entry and appears in the holdings
   list without altering any previously saved holding, even if another holding of the same asset
   and management source already exists.
7. **Given** the user leaves a required field empty or enters an invalid value (e.g. negative
   quantity, negative price, negative weight, or a purchase date in the future when one is
   provided), **When** they attempt to submit, **Then** the system blocks submission and shows a
   clear validation message identifying the problem.

---

### User Story 2 - Review My Holdings (Priority: P1)

As a Vaultfolio user, I want to see all the holdings I have entered, with their key details and how
they're distributed by value, so I can confirm my portfolio data is accurate and see at a glance
how my assets are spread out.

**Why this priority**: Entering data has no value unless the user can see and verify it. This is
the read counterpart that makes Story 1 useful and is a prerequisite for editing/deleting.

**Independent Test**: Can be fully tested by adding several holdings across different asset types
and management sources and confirming the Holdings list displays each one with its asset type,
quantity, price, date (where applicable), management source, and type-specific identifiers, plus a
distribution view reflecting their relative total values.

**Acceptance Scenarios**:

1. **Given** one or more holdings have been added, **When** the user opens the Holdings area,
   **Then** they see a list of all holdings showing asset type, name/identifier (where
   applicable), quantity, management source, price (or a clear indicator when none is recorded,
   e.g. Gold with no current value entered), and purchase date (or a clear indicator, e.g. "—",
   for asset types that don't track one or where it was left empty).
2. **Given** the user has added two separate Share or Bitcoin lots of the same asset, **When** they
   view the holdings list, **Then** both lots are shown as distinct entries, not merged into one.
3. **Given** the user adds an ETF or Gold holding for an asset that already exists under the same
   management source, **When** they view the holdings list, **Then** only one entry for that
   asset/management combination is shown, reflecting the latest quantity and (for ETF) average
   price.
4. **Given** the user has entered holdings with a known value (purchase price × quantity for
   Share/Bitcoin/ETF, or an entered current value for Gold), **When** they view the Holdings area,
   **Then** they see a distribution view (e.g. a chart) showing each holding's or asset type's
   share of the total value; holdings with no known value (e.g. Gold with no current value entered)
   are excluded from the distribution's percentages rather than counted as zero-value.
5. **Given** no holdings have been added yet, **When** the user opens the Holdings area, **Then**
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
- What happens when the user adds an ETF or Gold holding for an asset/management combination that
  already exists? The system MUST update the existing entry's quantity (and, for ETF, average
  price) in place rather than creating a new row, since these two types track only a current
  position per management source, not a purchase history.
- What happens when the user adds a Share or Bitcoin holding for an asset that already exists
  (even under the same management source)? The system MUST always create a new, independent lot —
  these two types never merge or update an existing entry.
- How does the system handle a purchase date in the future (for Share/Bitcoin holdings, the only
  types that record one)? If a purchase date is provided, a future date MUST be rejected as
  invalid; leaving the field empty is always valid.
- What happens when a user only knows what they currently hold and not when or at what price they
  acquired a Share or Bitcoin position? Purchase date MUST be optional for those two types, so the
  holding can be recorded with just quantity and management source; purchase price remains
  required as the best available cost reference even when the acquisition date is unknown.
- What happens when a Gold holding has no current value/price-per-gram entered? It MUST still save
  and appear in the holdings list with its weight and management source, but it MUST be excluded
  from the distribution view's percentage calculation (not treated as zero value) until a value is
  provided.
- How does the system handle a quantity, weight, or price of zero or negative (including the
  optional Gold current value, when provided)? All MUST be rejected as invalid (a holding must
  represent a real, positive amount, and any recorded price/value must be non-negative).
- What happens when the user leaves the Management field empty? The system MUST block submission,
  since Management is required for every holding of every asset type.
- What happens when the user has many holdings (e.g. dozens of lots across several assets and
  management sources)? The list MUST remain usable (e.g. scrollable, ideally sortable/filterable)
  rather than degrading.
- What happens when the user attempts to delete a holding that has already been removed in another
  browser tab/session? The system MUST handle this gracefully (e.g. informative message) rather
  than erroring unrecoverably.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The system MUST allow a user to add a new holding by selecting one of four asset
  types: ETF, Share, Gold, or Bitcoin.
- **FR-002**: The system MUST require a Management value (free text identifying who holds/manages
  the asset, e.g. "Private", "Roboadvisor", or a bank name) for every holding, regardless of asset
  type.
- **FR-003**: The system MUST require, for holdings of type Share or Bitcoin: quantity and
  purchase price. Purchase date MUST be optional for these two types, so a user who only wants to
  record what they currently hold — without caring about historic performance — can omit it.
- **FR-004**: The system MUST additionally require an ISIN and a name for holdings of type Share.
- **FR-005**: The system MUST require, for holdings of type ETF: ISIN, name, quantity, and average
  purchase price. ETF holdings MUST NOT have a purchase date field at all (not merely optional).
- **FR-006**: The system MUST require, for holdings of type Gold: weight in grams. Gold holdings
  MUST NOT have an ISIN, name, purity, purchase price, or purchase date field. The system MAY
  additionally accept an optional current value (or price-per-gram) for Gold, used solely to
  include it in the distribution view described in FR-011a.
- **FR-007**: The system MUST NOT require an ISIN, name, or weight for holdings of type Bitcoin —
  quantity, purchase price, and Management are sufficient.
- **FR-008**: The system MUST present only the fields relevant to the currently selected asset
  type, hiding or omitting fields that do not apply — including when editing an existing holding,
  where only the fields for that holding's own asset type are shown (e.g. no weight field when
  editing a Bitcoin holding, no purchase date field when editing an ETF holding).
- **FR-009**: The system MUST validate that quantity, weight, purchase price, and the optional Gold
  current value are positive numbers where provided, and, when a purchase date is provided (Share
  or Bitcoin only), that it is not in the future; it MUST block submission with a clear message
  otherwise. The system MUST also block submission when Management is left empty.
- **FR-010**: The system MUST validate that ISIN (when required) conforms to a well-formed ISIN
  format before allowing submission.
- **FR-011**: The system MUST save each Share or Bitcoin add-holding submission as its own
  independent entry ("lot"), even when an entry with the same asset and Management already exists
  — it MUST NOT automatically merge or average quantities/prices across entries for these two
  types.
- **FR-011a**: For ETF and Gold holdings, when a new add-holding submission matches an existing
  entry's asset identifier (ISIN for ETF; the fact of being Gold) AND Management value, the system
  MUST update that existing entry's quantity (and, for ETF, average purchase price) in place
  instead of creating a new entry. A submission for the same asset under a _different_ Management
  value MUST create a separate entry.
- **FR-012**: The system MUST display all of a user's holdings in a list, showing at minimum: asset
  type, identifying label (name/ISIN for ETF/Share, or "Gold"/"Bitcoin"), quantity or weight,
  Management, price (or a clear indicator that none was recorded, applicable to Gold), and purchase
  date (or a clear indicator that none applies or was recorded).
- **FR-012a**: The system MUST provide a distribution view showing each holding's (or asset type's)
  share of the user's total portfolio value, computed from quantity × price for Share/Bitcoin/ETF
  and from the optional entered current value for Gold; holdings with no known value MUST be
  excluded from the computed percentages rather than counted as zero.
- **FR-013**: The system MUST show a clear empty state when the user has no holdings yet, distinct
  from a loading or error state.
- **FR-014**: The system MUST allow a user to edit an existing holding's fields and persist the
  change, using the same field set (per FR-008, scoped to that holding's asset type) and validation
  rules as creation.
- **FR-015**: The system MUST allow a user to cancel an in-progress edit without altering the
  holding's stored values.
- **FR-016**: The system MUST allow a user to delete an existing holding, after an explicit
  confirmation step, permanently removing it from their holdings list.
- **FR-017**: The system MUST treat all monetary amounts (purchase price, Gold current value) as
  being in a single, implicit base currency; the system does not collect or store a currency per
  holding at this time.
- **FR-018**: The system MUST NOT perform any external market-data lookups, price fetching, or
  import operations as part of adding, editing, or viewing holdings — all values are user-supplied.
- **FR-019**: The system MUST persist added, edited, and deleted holdings so they remain accurate
  across sessions (e.g. reloading the app or returning later shows the current state).

### Key Entities

- **Holding**: A record of one asset position owned by the user. Common attributes: asset type
  (ETF, Share, Gold, or Bitcoin), Management (required free text identifying who holds/manages the
  asset, e.g. "Private", "Roboadvisor", or a bank name). Behavior and remaining attributes differ
  by asset type:
  - **ETF**: ISIN, name, quantity, average purchase price (all required); no purchase date. A
    submission for an ISIN + Management combination that already exists updates that entry's
    quantity/average price rather than creating a new one — so ETF holdings are effectively one
    row per (ISIN, Management) pair, not per purchase.
  - **Share**: ISIN, name, quantity, purchase price (all required), purchase date (optional). Each
    submission is always a new, independent lot, even for a repeated ISIN + Management.
  - **Gold**: weight in grams (required), optional current value/price-per-gram (used only for the
    distribution view); no ISIN, name, purity, purchase price, or purchase date. A submission for a
    Management value that already has a Gold entry updates that entry's weight rather than creating
    a new one — one row per Management source, not per purchase.
  - **Bitcoin**: quantity, purchase price (both required), purchase date (optional); no ISIN, name,
    or weight. Each submission is always a new, independent lot, even for a repeated Management.
- **Asset Type**: A fixed classification (ETF, Share, Gold, Bitcoin) that determines which
  additional fields a Holding requires, whether it accumulates as separate lots or a single
  updated position per Management source, and how it is labeled in the holdings list.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A user can add a new holding of any of the four asset types, from opening the "add
  holding" action to seeing it appear in the list, in under 1 minute.
- **SC-002**: 100% of holdings entered with invalid data (negative quantity/weight/price, a future
  date when one is provided, malformed ISIN, missing required type-specific field, or missing
  Management) are rejected with a clear, specific validation message before being saved.
- **SC-003**: A user can locate and confirm the details of any previously entered holding within
  the holdings list without needing to consult any source outside the application.
- **SC-004**: A user can correct a mistaken holding (via edit or delete-and-recreate) and see the
  corrected state reflected immediately, with zero impact on the accuracy of any other holding.
- **SC-005**: Repeated Share/Bitcoin purchases of the same asset always result in the same number of
  visible lots as the number of times the user added a holding for that asset — zero unintended
  merges — while repeated ETF/Gold additions for the same asset and Management source always result
  in exactly one visible entry, correctly updated.
- **SC-006**: Holdings entered in one session remain fully intact (same values, same count) when
  the user returns in a later session.
- **SC-007**: A user can see, at a glance, the relative share of their total portfolio value held
  in each asset/asset type, using only the prices and values entered manually (no external lookups
  required for this feature).

## Assumptions

- "Base currency" is a single, application-wide currency (not configurable per holding in this
  feature); currency configuration and multi-currency support are out of scope and may be
  addressed by a future feature.
- Live market-price lookups and true portfolio-level valuation (fetching current prices for ETF/
  Share/Bitcoin) remain out of scope for this feature — this feature covers recording what was
  bought (Share/Bitcoin/ETF) or is currently held (Gold), plus a distribution view computed only
  from user-supplied prices/values (purchase price for Share/Bitcoin, average price for ETF,
  optional current value for Gold). A holding saved without a purchase date can still be valued at
  today's price by a future feature, it just won't support a time-based P&L view for that lot.
- Weight for Gold is entered in grams only; the system does not offer a unit selector or convert
  other units (e.g. troy ounces) — the user converts before entry. Purity is not tracked for this
  feature.
- Management is a free-text field, not a fixed enum of providers; the system does not validate it
  against a known list of banks/roboadvisors — any non-empty value is accepted.
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
