# Feature Specification: Holdings Rework

**Feature Branch**: `045-holdings-rework`

**Created**: 2026-10-08

**Status**: Draft

**Input**: User description: "Überarbeitung der Bestände: verschlüsselte Speicherung wie die anderen Datenfeatures, ISIN nur für ETF und Aktie, Edelmetalle und Krypto nur noch per Auswahl (Krypto durchsuchbar), Notizfeld für jede Anlageart, Edelmetall-Menge wahlweise in Gramm oder Unzen, Krypto-Menge bis Satoshi-Genauigkeit, Import wieder ausbauen, Bestandsformular überarbeiten, leere Dashboardkacheln überarbeiten (Gesamtwert-Kachel zeigt vorerst den Kaufwert), Testsets für beide Testaccounts. Die Marktwert-/Preis-API-Anbindung ist nicht Teil dieser Spec (eigene Spec 046)."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Holdings are protected like all other personal data (Priority: P1)

A member's holdings (what they own, how much, at which broker or bank, what they paid, their notes) are stored encrypted at rest, exactly like the other data features. Administrators and anyone with database access cannot read them. Holdings follow the same key-management behaviour as the other features (key rotation, maintenance/unavailable-key handling, account deletion).

**Why this priority**: Holdings are the most sensitive financial data in the app and the only data feature still stored readable. This must be right before real users arrive.

**Independent Test**: Create a holding, inspect the stored record, and verify no holding detail is readable; verify the holding still appears correctly in the app, and that deleting the account removes all of its holdings.

**Acceptance Scenarios**:

1. **Given** a member saves a holding, **When** the stored record is inspected directly, **Then** none of the holding's details (type, identifier, amounts, broker/bank, notes) are readable.
2. **Given** encryption keys are temporarily unavailable, **When** the member opens holdings, **Then** they see the same "temporarily unavailable" behaviour as the other encrypted features instead of an error or empty list.
3. **Given** an encryption key rotation is performed by an administrator, **When** it completes, **Then** all holdings remain readable and are covered by the encryption status shown to administrators.
4. **Given** a member account is deleted, **Then** all of its holdings are removed.
5. **Given** a member saves an ETF holding for the same ISIN and the same broker/bank twice, **Then** the two entries are merged exactly as before (merging still works although the data is encrypted).

---

### User Story 2 - Pick precious metal and crypto asset from a fixed list (Priority: P1)

When adding a precious-metal or crypto holding, the member chooses the asset from a list instead of typing a free-text name. Precious metals offer Gold, Silver, Platinum, Palladium. Crypto offers a curated list of the most common coins that is searchable by typing. ETFs and shares keep their required ISIN; precious metals, crypto and deposit money have no ISIN.

**Why this priority**: Free-text names cannot be reliably matched to market data later (spec 046) and cause duplicates ("Bitcoin" vs. "BTC"). A fixed vocabulary is the prerequisite for everything that follows.

**Independent Test**: Add one holding per asset type; verify metals and crypto can only be chosen from lists, the crypto list can be filtered by typing, and ISIN is requested only for ETF and share.

**Acceptance Scenarios**:

1. **Given** the member selects the precious-metal type, **When** they open the asset field, **Then** they can choose only Gold, Silver, Platinum or Palladium (shown in the UI language) and cannot type free text.
2. **Given** the member selects the crypto type, **When** they type part of a coin name or symbol, **Then** the list narrows to matching coins and they can pick one; free text that is not in the list cannot be saved.
3. **Given** the member selects ETF or share, **Then** an ISIN is required and validated as before; for precious metal, crypto and deposit money no ISIN field is shown.
4. **Given** two precious-metal holdings of the same metal at the same broker/bank, **Then** they are merged like other mergeable types, based on the chosen metal rather than a typed name.
5. **Given** a holding is saved with a chosen asset, **Then** the stored value is a stable identifier that does not change with UI language.

---

### User Story 3 - Enter quantities the way they are actually held (Priority: P2)

For precious metals the member chooses per holding whether they enter the quantity in grams or in troy ounces; for crypto the quantity can be as small as a single satoshi (eight decimal places) without rounding errors.

**Why this priority**: Bars are bought in grams, coins in ounces; crypto is commonly held in tiny fractions. Without this, values would be wrong or entry impossible.

**Independent Test**: Add a metal holding in ounces and one in grams and verify both display consistently and contribute the correct amount to totals; add a crypto holding of 0.00000001 and verify it is stored and displayed exactly.

**Acceptance Scenarios**:

1. **Given** a precious-metal holding, **When** the member selects "ounces" and enters 1, **Then** the holding is understood as 31.1035 g and is displayed consistently (the chosen unit is shown as entered).
2. **Given** a crypto holding, **When** the member enters 0.00000001, **Then** it is accepted and displayed exactly, with no rounding to zero.
3. **Given** a crypto quantity with more than eight decimal places, **Then** submission is blocked with a clear message.
4. **Given** a quantity of zero or a negative quantity, **Then** submission is blocked for every type.

---

### User Story 4 - Add personal notes to any holding (Priority: P2)

Every holding, regardless of type, has an optional note where the member can record thoughts, reasons or other remarks. The note is length-limited and stored encrypted with the rest of the holding.

**Why this priority**: Replaces the information users used to squeeze into free-text names ("Goldbarren 100g, Opa") and is cheap to deliver.

**Independent Test**: Save holdings of each type with and without a note, with a note at the maximum length and one over the limit.

**Acceptance Scenarios**:

1. **Given** any holding type, **When** the member enters a note up to the limit, **Then** it is saved and shown when editing.
2. **Given** a note longer than the limit, **Then** submission is blocked and the remaining/maximum length is visible while typing.
3. **Given** no note, **Then** the holding saves normally.

---

### User Story 5 - Clear dashboard tiles for holdings (Priority: P2)

The two holdings dashboard tiles behave like the other tiles. When a member has no holdings, both show the shared empty-state tile with an explanation and a call to action to add the first holding. The total-value tile no longer shows a "coming soon" placeholder; until market values exist it shows the total purchase value, clearly labelled "Kaufwert" (purchase value).

**Why this priority**: Consistent, honest dashboard; the total-value tile currently shows nothing useful.

**Independent Test**: Open the dashboard with an account without holdings (empty states with working call to action) and with the seeded account (purchase-value total and distribution chart).

**Acceptance Scenarios**:

1. **Given** no holdings, **When** the member opens the dashboard, **Then** the distribution tile and the total-value tile each show the shared empty-state design with a link/button to add a holding.
2. **Given** holdings exist, **Then** the total-value tile shows the sum of purchase values labelled as purchase value, not as current value.
3. **Given** loading holdings fails, **Then** the tiles show an error state consistent with the other tiles, not the empty state.
4. **Given** holdings without a purchase price (for example precious metals with only a current value, or deposit money), **Then** the total states clearly which holdings it is based on.

---

### User Story 6 - Realistic and comprehensive test data for both test accounts (Priority: P3)

The comprehensive test account receives a large edge-case holdings dataset; the second test account receives a small realistic one with real ISINs. Both are created by the existing seeding tools and replace any holdings the account already has.

**Why this priority**: Needed to verify the UI and later the market-value feature, but delivers no end-user value itself.

**Independent Test**: Run the seeding tools for both accounts and open holdings and the dashboard for each.

**Acceptance Scenarios**:

1. **Given** the comprehensive account, **When** seeding runs, **Then** it contains all five types, merge cases, several brokers/banks, very large and very small values, satoshi-sized crypto quantities, metals in grams and ounces and maximum-length notes.
2. **Given** the realistic account, **When** seeding runs, **Then** it contains a plausible portfolio (for example a few widely held ETFs and shares with real, checksum-valid ISINs, some gold, one or two major coins, a savings balance).
3. **Given** seeding is re-run, **Then** the account's holdings are replaced, not duplicated.

---

### User Story 7 - Holdings import is removed for now (Priority: P3)

The holdings import is taken out of the app (screens, entry points and server functionality) and will return later as its own feature. Exporting holdings, if present, stays.

**Why this priority**: The import is built for the old data shape; keeping it alive would force it to be reworked twice.

**Independent Test**: Verify no import entry point exists in the holdings UI or the API, and that export still works.

**Acceptance Scenarios**:

1. **Given** the holdings screen, **Then** there is no import action.
2. **Given** the API, **Then** there is no holdings-import function.
3. **Given** the holdings screen, **When** the member exports, **Then** the export works with the reworked data (including note and the chosen asset and unit).

---

### Edge Cases

- A coin or metal is later removed from the curated list: holdings already stored with it must keep displaying with a readable fallback instead of breaking.
- Very long notes composed of multi-byte characters or emoji: the limit counts characters consistently in form and server.
- Metals entered in ounces with many decimals: conversion must not produce visible rounding artefacts in display; the entered value is preserved.
- Very large quantities or prices: stored and summed without precision loss.
- Same coin at the same broker twice: crypto holdings continue to be separate entries (not merged), as today.
- Share and crypto holdings remain separate entries; ETF, precious-metal and deposit-money holdings continue to merge.
- Encrypted data cannot be read for a single record (corrupt record): other holdings still load and the problem is reported clearly rather than silently hiding data.
- Form is opened for editing a holding: type cannot silently change to a type with different required fields without re-validation.

## Requirements _(mandatory)_

### Functional Requirements

**Protection**

- **FR-001**: All holding details (type, asset identifier, quantity, unit, prices, broker/bank, note) MUST be stored encrypted at rest using the same protection as the other data features.
- **FR-002**: Holdings MUST participate in the same key-management behaviour as the other encrypted features: key rotation coverage, administrator-visible encryption status, "temporarily unavailable" behaviour when keys are unavailable, and removal on account deletion.
- **FR-003**: Merging of equal holdings (same type, same identifier, same broker/bank for mergeable types) MUST keep working, and validation rules MUST be enforced for every write regardless of how the data is stored.
- **FR-004**: No migration of existing holdings is required; the data model MUST start in its final shape.

**Asset identification**

- **FR-005**: ISIN MUST be required and validated (format and checksum) for ETF and share holdings, and MUST NOT be requested or stored for precious-metal, crypto or deposit-money holdings.
- **FR-006**: Precious-metal holdings MUST identify the metal from a fixed list: Gold, Silver, Platinum, Palladium, stored as a language-independent code; free-text names MUST NOT be accepted.
- **FR-007**: Crypto holdings MUST identify the coin from a curated list of roughly the 50–100 most common coins, each with a stable identifier suitable for later price lookup (spec 046); free-text names MUST NOT be accepted.
- **FR-008**: The crypto selector MUST be searchable by name and symbol.
- **FR-009**: Display names for metals and coins MUST be available in German and English; the metal and coin lists MUST be defined once and used consistently by UI and server validation.
- **FR-010**: Deposit-money holdings keep a free-text name (account/product description).

**Quantities**

- **FR-011**: For precious metals the member MUST be able to choose grams or troy ounces (1 oz = 31.1035 g) per holding; the entered unit MUST be preserved and displayed, and amounts MUST be convertible to a common unit for totals and later pricing.
- **FR-012**: Crypto quantities MUST support up to eight decimal places and MUST be stored and displayed without rounding; more than eight decimals MUST be rejected with a clear message.
- **FR-013**: Quantities MUST be greater than zero for all types; amounts MUST be exchanged between UI and server in a form that does not lose precision.

**Notes**

- **FR-014**: Every holding type MUST support an optional note with a defined maximum length (default 500 characters), enforced identically in form and server, and shown with the remaining length while editing.

**Form**

- **FR-015**: The holding form MUST show only the fields relevant to the selected type: ETF/share → ISIN, name, quantity, purchase price (share also optional purchase date); precious metal → metal selector, quantity with unit selector and optional current value; crypto → searchable coin selector, quantity, purchase price and optional purchase date; deposit money → name and current value; all types → broker/bank and note.
- **FR-016**: Validation messages MUST be field-specific and available in German and English.
- **FR-017**: New or changed interactive elements MUST carry stable test identifiers according to the project's test-id conventions.
- **FR-018**: Field definitions per asset type MUST come from one shared source rather than being duplicated between domain and UI where module boundaries allow.

**Import**

- **FR-019**: The holdings import (screens, entry points and server functions) MUST be removed; holdings export, where present, MUST be kept and updated to the new data shape.

**Dashboard**

- **FR-020**: With no holdings, the holdings distribution tile and the total-value tile MUST show the shared empty-state design with a call to action to add the first holding.
- **FR-021**: The total-value tile MUST show the total purchase value clearly labelled as purchase value (not current value), replacing the "coming soon" placeholder, and MUST indicate when some holdings are not included because they have no purchase price.
- **FR-022**: Failed loading MUST show an error state distinct from the empty state, consistent with other tiles.

**Test data**

- **FR-023**: A holdings seed MUST be added to the existing seeding tools, creating data through the application's public interface so that encryption is applied normally, and replacing the account's existing holdings.
- **FR-024**: The comprehensive test account's dataset MUST cover all types, merge cases, multiple brokers/banks, extreme values, satoshi quantities, both metal units and maximum-length notes; the realistic account's dataset MUST use real, checksum-valid ISINs and a plausible portfolio.

**Follow-ups within scope**

- **FR-025**: API documentation, request collections and existing automated tests MUST be updated to the new data shape.

### Key Entities

- **Holding**: One position of a member. Has a type (ETF, share, precious metal, crypto, deposit money), a broker/bank, an optional note, and type-specific data: identifier (ISIN, metal code or coin identifier; none for deposit money), quantity (with unit for metals), purchase price/date or current value as applicable. Stored encrypted.
- **Precious-metal catalogue**: Fixed list of four metals with code and German/English display names.
- **Crypto catalogue**: Curated list of coins with stable identifier, symbol and German/English display names.
- **Seed dataset**: Named holdings datasets (comprehensive, realistic) used to populate the two test accounts.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: In stored records, 0 holding details are readable without the application's keys.
- **SC-002**: 100% of precious-metal and crypto holdings reference an entry from the fixed lists; no free-text asset names exist.
- **SC-003**: A member can add a holding of any type, including selecting the asset and unit, in under one minute.
- **SC-004**: A crypto quantity of 0.00000001 is stored and displayed exactly; an ounce quantity displayed back equals the entered value.
- **SC-005**: With an account without holdings, both holdings tiles show the empty state with a working call to action; with holdings, the total-value tile matches the sum of purchase values to the cent.
- **SC-006**: After running the seeding tools, both test accounts show populated holdings and dashboard tiles, and re-running yields the same result with no duplicates.
- **SC-007**: No import action for holdings exists anywhere in the UI or API; export continues to work.
- **SC-008**: Existing automated tests are updated and pass, and new tests cover the catalogues, unit conversion, quantity precision, note limit and encryption behaviour.

## Assumptions

- There are no real users and no existing holdings to preserve, so no data migration or backwards compatibility with the previous data shape is needed.
- The market-value/price feature (spec 046) is separate; this spec only prepares stable identifiers for it.
- ETFs and ETCs/ETNs with an ISIN are entered as ETF; physical metals and native coins have no ISIN.
- Troy ounce (31.1035 g) is the meaning of "ounce" for precious metals.
- The note limit defaults to 500 characters and applies to all types.
- The crypto list is curated by the project and extended by releases, not by users; its exact contents are decided during planning.
- The test accounts are `claude@allwang.family` (comprehensive) and `claudius@allwang.family` (realistic); seeds replace holdings of those accounts only.
- Holdings export exists today in some form and will be kept; a new import will be specified separately later.
