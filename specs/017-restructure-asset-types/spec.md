# Feature Specification: Restructure Asset Types (Precious Metal / Crypto)

**Feature Branch**: `017-restructure-asset-types`

**Created**: 2026-09-04

**Status**: Draft

**Input**: User description: "Restructure holding asset types: rename GOLD to PRECIOUS_METAL and BITCOIN to CRYPTO, and add a required `name` field to both (reusing the existing `name` field already used by ETF/SHARE) so users can freely enter the specific asset name (e.g. \"Gold\", \"Silver\", \"Platinum\" for precious metal; \"Bitcoin\", \"Ethereum\" for crypto). This amends the existing 003-manual-holdings-entry feature's asset type model, including a data migration for existing GOLD/BITCOIN rows to PRECIOUS_METAL/CRYPTO."

**Design**: [design.md](./design.md) — reviewed mockup and approved layout for the add/edit dialog and holdings list/distribution changes below.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Record a precious metal holding by name (Priority: P1)

A user holds physical precious metals other than gold (e.g. silver, platinum) and wants to record them the same way they record gold today, without the system forcing every such holding to be labeled "gold".

**Why this priority**: This is the core value of the change — today the "Gold" asset type cannot represent any other precious metal, so users misrepresent or omit non-gold holdings entirely.

**Independent Test**: Can be fully tested by adding a holding of type "Precious metal" with the name "Silver" and a weight, saving it, and seeing it listed as a silver holding distinct from a gold one — delivers value on its own even before the crypto rename ships.

**Acceptance Scenarios**:

1. **Given** the user is adding a holding, **When** they select asset type "Precious metal", **Then** the form requires a name (free text, e.g. "Gold", "Silver", "Platinum") in addition to the existing weight-in-grams field, and saving with valid values creates a new holding entry — or, if a holding with the same name and Management value already exists, updates that entry per the existing update-in-place behavior (FR-011a of 003-manual-holdings-entry).
2. **Given** two precious metal holdings with different names ("Gold" and "Silver") under the same Management value, **When** the user submits both, **Then** they are saved as two separate entries, not merged into one.
3. **Given** an existing precious metal holding named "Gold", **When** the user adds another precious metal holding also named "Gold" under the same Management value, **Then** it updates the existing entry in place, matching today's single-asset gold behavior.

---

### User Story 2 - Record a crypto holding by name (Priority: P1)

A user holds cryptocurrencies other than Bitcoin (e.g. Ethereum) and wants to record them the same way they record Bitcoin today.

**Why this priority**: Equally core — today's "Bitcoin" asset type cannot represent any other cryptocurrency.

**Independent Test**: Can be fully tested by adding a holding of type "Crypto" with the name "Ethereum", a quantity, and a purchase price, saving it, and seeing it listed as its own lot distinct from a Bitcoin holding.

**Acceptance Scenarios**:

1. **Given** the user is adding a holding, **When** they select asset type "Crypto", **Then** the form requires a name (free text, e.g. "Bitcoin", "Ethereum") in addition to the existing quantity and purchase price fields, and an optional purchase date, and saving with valid values creates a new separate lot — matching today's per-lot Bitcoin behavior (each submission is its own row, never merged).
2. **Given** the user submits a crypto holding with an empty name, **When** they attempt to save, **Then** the system rejects the submission with a clear validation message, the same way it already rejects a missing ISIN/name for Share today.

---

### User Story 3 - Existing gold and Bitcoin holdings keep working after the change (Priority: P1)

A user who already recorded gold and Bitcoin holdings before this change ships must see those same holdings, correctly labeled, after the change ships — with no data loss and no manual re-entry.

**Why this priority**: Without this, the rename breaks every existing user's portfolio data. This must ship in the same release as the rename, not as a follow-up.

**Independent Test**: Can be fully tested by taking a database containing pre-change gold and Bitcoin holdings, applying the change, and confirming those holdings now appear as precious metal / crypto holdings named "Gold" / "Bitcoin" respectively, with all other fields (weight, quantity, purchase price, purchase date, Management, current value) unchanged.

**Acceptance Scenarios**:

1. **Given** a holding that was saved before this change as asset type "Gold", **When** the change is deployed, **Then** that holding is now classified as "Precious metal" with name "Gold", and every other field it had keeps its prior value.
2. **Given** a holding that was saved before this change as asset type "Bitcoin", **When** the change is deployed, **Then** that holding is now classified as "Crypto" with name "Bitcoin", and every other field it had keeps its prior value.
3. **Given** the migration has already run once, **When** the system starts up again, **Then** it does not re-run the migration or duplicate/alter already-migrated rows.

---

### Edge Cases

- What happens when a user enters a precious metal or crypto name that differs only in case or surrounding whitespace from an existing entry (e.g. "gold" vs "Gold") under the same Management value? The system MUST treat names as case-sensitive, exact-match text for the purpose of matching an existing precious metal entry to update in place — "gold" and "Gold" are treated as different names, consistent with how ISIN/name matching already behaves for ETF today.
- How does the system handle a name field left blank for a precious metal or crypto holding? It MUST be rejected as invalid, the same way a missing name is already rejected for Share/ETF.
- What happens to the asset-distribution view's grouping/labels for precious metal and crypto holdings? Each holding continues to be valued and shown individually by its name, the same way ETF/Share holdings are already shown by name today, rather than being grouped only by asset type.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The system MUST rename the asset type formerly called "Gold" to "Precious metal", without changing any of that type's existing required/optional fields other than as specified in FR-003.
- **FR-002**: The system MUST rename the asset type formerly called "Bitcoin" to "Crypto", without changing any of that type's existing required/optional fields other than as specified in FR-003.
- **FR-003**: The system MUST require a name (free text) for holdings of type Precious metal and of type Crypto, reusing the same name field/requirement already used by ETF and Share holdings today.
- **FR-004**: The system MUST allow the name entered for a Precious metal or Crypto holding to be any free text the user chooses (e.g. "Gold", "Silver", "Platinum" for Precious metal; "Bitcoin", "Ethereum" for Crypto) — it MUST NOT be restricted to a fixed list of values.
- **FR-005**: For Precious metal holdings, the system MUST use the combination of name and Management value (rather than just Management value, or just "being Gold") to decide whether a new add-holding submission updates an existing entry in place or creates a new one, matching the existing update-in-place behavior for that type (003-manual-holdings-entry FR-011a).
- **FR-006**: For Crypto holdings, the system MUST continue to save each add-holding submission as its own separate lot, never merged with a prior submission of the same name — matching the existing per-lot behavior for that type (003-manual-holdings-entry FR-011).
- **FR-007**: The system MUST migrate every existing holding of asset type "Gold" to asset type "Precious metal" with name "Gold", and every existing holding of asset type "Bitcoin" to asset type "Crypto" with name "Bitcoin", preserving every other field's existing value, before the restructured asset types are used to serve any request.
- **FR-008**: The migration in FR-007 MUST be safe to run exactly once and MUST NOT re-apply itself or alter already-migrated data on subsequent system startups.
- **FR-009**: The system MUST validate a submitted Precious metal or Crypto name the same way it already validates the ETF/Share name field (non-empty after trimming whitespace), rejecting an empty or whitespace-only name with a clear message.
- **FR-010**: The system MUST display each Precious metal and Crypto holding using its entered name (e.g. "Silver", "Ethereum") everywhere the holdings list, edit form, and asset-distribution view currently display a holding's identifying label.
- **FR-011**: Existing API clients and stored data that reference asset type "Gold" or "Bitcoin" MUST no longer be accepted for new writes once this change ships — new holdings MUST be created only as "Precious metal" or "Crypto".
- **FR-012**: The add-holding dialog MUST present the asset-type choice as a set of selectable options (one per type, all visible at once), not as a dropdown — restoring the 003-manual-holdings-entry design.md's originally-approved type selector, which the shipped implementation deviated from. The edit-holding dialog continues to show the holding's own type locked, as today.
- **FR-013**: The "Distribution by value" panel MUST also appear on the Holdings page itself (in addition to its current placement on the Dashboard), grouped and labeled per FR-010 — restoring the 003-manual-holdings-entry design.md's originally-approved placement, which the shipped implementation moved to the Dashboard only.

### Key Entities

- **Asset Type**: A fixed classification a holding can have. Renamed set: ETF, Share, Precious metal, Crypto (previously: ETF, Share, Gold, Bitcoin). Determines which fields are required/optional/absent on a holding (unchanged from 003-manual-holdings-entry except for the additions below).
- **Holding**: Unchanged core entity, except that holdings of type Precious metal and Crypto now carry a required name (free text), in addition to the fields they already had (weight in grams and optional current value for Precious metal; quantity, purchase price, and optional purchase date for Crypto).

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A user can record a non-gold precious metal holding (e.g. silver) and a non-Bitcoin crypto holding (e.g. Ethereum) end-to-end (add, view in the list, see it counted in the distribution view) without any workaround or mislabeling.
- **SC-002**: 100% of holdings that existed as "Gold" or "Bitcoin" before the change are visible after the change with the correct new asset type, the correct name ("Gold"/"Bitcoin" respectively), and every other field unchanged.
- **SC-003**: Re-deploying or restarting the system after the migration has already run produces zero additional changes to already-migrated holdings.
- **SC-004**: A submission with a missing name for Precious metal or Crypto is rejected with a clear, actionable message in under 1 second, the same as today's missing-name rejection for Share/ETF.

## Assumptions

- The existing "weight in grams" and optional "current value" fields for Precious metal, and "quantity"/"purchase price"/"purchase date" fields for Crypto, are unchanged by this feature — only the type's label and the new name field change.
- Precious metal keeps its existing update-in-place merge behavior (per Management + now also name); Crypto keeps its existing per-lot behavior — this feature does not change which types merge and which don't, only what key is used for Precious metal's merge.
- No historical audit trail of the pre-migration asset type value is required to be retained; the migration overwrites the type/name in place.
- This is a single-user-facing-language change in terms of scope (no new asset-type-specific fields beyond name) — the underlying storage rename is an implementation concern for the planning phase, not specified further here.
- Existing translations (English/German) for asset type labels and field names will be updated to match the new type names and the new "name" field label; the specific translated strings are a planning/implementation detail.
- FR-012 and FR-013 correct two visual deviations from 003-manual-holdings-entry's approved design (a dropdown instead of a type-selector control; the distribution panel shipped on the Dashboard only) that surfaced during this feature's UX mockup review — see design.md. They are scoped to this feature because the type selector and distribution grouping are both touched by the Precious metal/Crypto rename anyway; no other Holdings-page behavior changes.
