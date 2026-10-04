# Feature Specification: Vermögensentwicklung (Net-Worth Tracking)

**Feature Branch**: `038-networth-tracking`

**Created**: 2026-10-04

**Status**: Draft

**Design**: [design.md](design.md)

**Input**: User description: "Vermögensentwicklung (Net-Worth-Tracking): Nutzer erfassen zu einem bestimmten Datum (Stichtag) einen Snapshot ihres Vermögens, aufgeteilt in frei wählbare Assetklassen/Positionen (z. B. Bargeld, Edelmetalle, Giralgeld, Aktien, Krypto – aber auch Whiskey, Autos, Immobilien oder beliebige andere Gegenstände mit einem Wert). Felder sollen nicht zu strikt sein. Frühere Zeitpunkte müssen nachtragbar sein (der Nutzer pflegt aktuell Excel mit historischen Stichtagen), sodass eine Gesamt-Vermögensentwicklung über die Zeit sichtbar wird. Optional: Werte aus dem Bestände-Feature als Vorschlag übernehmen – dort fehlt aber noch der aktuelle Marktwert. Darstellung: Übersicht analog zur Einkommensentwicklung, inklusive PDF-Export und Dashboard-Kachel (mit Drag-and-Drop-Reihenfolge und Sichtbarkeit)."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Record a wealth snapshot for a date (Priority: P1)

A user opens the Historic Wealth Development domain and records what they own on a given reference date (Stichtag). A snapshot consists of any number of entries, each with a free-text name, a side (asset or liability), a class and an amount. Amounts are always entered as positive numbers; the side decides whether an entry adds to or reduces the net worth. The user can pick a class from a set of suggested ones (assets: cash, precious metals, bank balances, shares/funds, crypto, real estate, vehicles, collectibles, other; liabilities: mortgage, loan, other debt) or type their own, so unusual items such as whiskey, a classic car or a private loan fit without forcing them into a fixed form. The date can be today or any date in the past. Snapshots can be edited and deleted at any time.

**Why this priority**: Capturing the data is the purpose of the feature; every other view depends on it. Even alone it gives users one structured place for their wealth at a point in time.

**Independent Test**: Create a snapshot for today with entries in five asset classes, one of them a custom class ("Whiskey"); reload the page and verify the snapshot persists with all entries and its total, then edit one value and delete one entry.

**Acceptance Scenarios**:

1. **Given** a user without any snapshot, **When** they create a snapshot for a date with several entries, **Then** the snapshot is saved and shown with per-class sub-totals, total assets, total liabilities and the net worth.
2. **Given** the entry form, **When** the user types an asset class that is not in the suggestions, **Then** it is accepted and offered as a suggestion for later entries.
3. **Given** an existing snapshot, **When** the user changes, adds or removes entries, **Then** the totals update and the change persists.
4. **Given** a snapshot already exists for a date, **When** the user tries to create another one for the same date, **Then** they are told so and offered to open the existing one instead.
5. **Given** an entry with an invalid value (non-numeric, negative, missing name or class, missing date, a date in the future), **When** the user saves, **Then** the save is rejected with a message naming the offending field.
6. **Given** a snapshot, **When** the user deletes it, **Then** it disappears from the overview, the chart and all totals after confirmation.

---

### User Story 2 - Backfill earlier snapshots quickly (Priority: P1)

The user maintains a history in a spreadsheet and wants to bring earlier reference dates over without re-typing everything. They can create a new snapshot by copying the entries of an existing one (names and classes prefilled, values to be updated) and can add snapshots for past dates in any order.

**Why this priority**: The development view is only meaningful with several data points; a slow backfill would stop users from building a history at all.

**Independent Test**: With one existing snapshot, create three past snapshots using "copy from existing", adjust values, and verify all four appear in chronological order regardless of the order they were created in.

**Acceptance Scenarios**:

1. **Given** an existing snapshot, **When** the user creates a new one and chooses to copy from it, **Then** all entries appear with name and class prefilled and the user only needs to enter the values.
2. **Given** snapshots created out of chronological order, **When** the overview is shown, **Then** they are always ordered by reference date.
3. **Given** a copied snapshot, **When** the user removes an entry that did not exist at that earlier date, **Then** it is not part of that snapshot nor of its totals.

---

### User Story 3 - See the wealth development over time (Priority: P1)

The Historic Wealth Development page shows an overview analogous to the existing income-development view: a chart of the net worth over the reference dates, a breakdown by class (assets by class, liabilities as their own series, so the user sees what drives growth), and a table of snapshots with total assets, total liabilities, net worth, and absolute and percentage change of the net worth versus the previous snapshot. The user can filter the displayed period and hide/show asset classes in the chart.

**Why this priority**: Making the development visible is the stated goal of the feature.

**Independent Test**: With four snapshots across different classes, open the overview and verify the total series, the per-class breakdown, the change values versus the previous snapshot, and the effect of the period filter and class toggles.

**Acceptance Scenarios**:

1. **Given** at least two snapshots, **When** the user opens the overview, **Then** the net worth is shown over time with the change (absolute and percent) from each snapshot to the previous one.
2. **Given** snapshots whose entries use different classes, **When** the breakdown is shown, **Then** each class has its own series and liabilities are clearly separated from assets; a class missing in a snapshot counts as zero there.
3. **Given** only one snapshot, **When** the overview is shown, **Then** the current composition is displayed with a hint that a second snapshot is needed to show a development.
4. **Given** no snapshot, **When** the overview is shown, **Then** an empty state invites the user to record the first snapshot.
5. **Given** a period filter, **When** the user narrows it, **Then** chart, breakdown and table cover only the snapshots within it and changes are computed within that range.

---

### User Story 4 - Dashboard tile with the current wealth (Priority: P2)

The dashboard shows a wealth tile with the total of the latest snapshot, its change versus the previous snapshot, and a small trend of the history. The tile links to the Historic Wealth Development page and takes part in the existing dashboard tile ordering and visibility settings. With no data it shows an inviting empty state.

**Why this priority**: Valuable visibility, but depends on Stories 1 and 3.

**Independent Test**: With two snapshots, open the dashboard and verify the tile shows the latest total and change; hide and reorder it via the tile settings and verify the choice persists.

**Acceptance Scenarios**:

1. **Given** two or more snapshots, **When** the dashboard loads, **Then** the tile shows the latest total, the change versus the previous snapshot and a trend.
2. **Given** no snapshot, **When** the dashboard loads, **Then** the tile shows an empty state linking to the page.
3. **Given** the tile settings, **When** the user hides or reorders the tile, **Then** the dashboard reflects it and remembers it across sessions.

---

### User Story 5 - Personal balance sheet for a reference date (Priority: P2)

For a reference date chosen by the user (default: the latest snapshot) the page offers a balance-sheet view for users who think in financial terms. Assets (Aktiva) are listed on one side, grouped into balance groups, liabilities (Passiva) on the other, and the net worth is shown as the balancing figure (equity), so both sides always add up to the same total. Assets are grouped into liquid funds, securities and crypto, tangible assets and other; liabilities into short-term, long-term and other. Each class belongs to one balance group; suggested classes come with a default group, and for a user-defined class the user picks the group once (it is then remembered and prefilled for later entries). Entries whose class has no group appear under "other". The balance sheet is a view only; it needs no data beyond what Story 1 collects.

**Why this priority**: It lifts the feature for financially literate users, but all value of Stories 1-3 exists without it.

**Independent Test**: With a snapshot containing assets in several classes and a mortgage, open the balance sheet and verify the grouping, the group sub-totals, that assets equal liabilities plus net worth, and that changing a class's group moves its entries.

**Acceptance Scenarios**:

1. **Given** a snapshot with assets and liabilities, **When** the user opens the balance sheet, **Then** assets and liabilities are shown by group with sub-totals and the net worth balances both sides.
2. **Given** a snapshot whose liabilities exceed its assets, **When** the balance sheet is shown, **Then** the net worth is shown as negative equity and both sides still balance.
3. **Given** a user-defined class without a group, **When** the user first uses it, **Then** they are asked for its balance group once; later entries and snapshots use that group.
4. **Given** the user changes the group of a class, **When** they open the balance sheet of any snapshot, **Then** all entries of that class appear under the new group.
5. **Given** several snapshots, **When** the user picks another reference date, **Then** the balance sheet shows that date.
6. **Given** no snapshot, **When** the user opens the balance sheet, **Then** an empty state invites the user to record a snapshot.

---

### User Story 6 - Export the wealth development as PDF (Priority: P2)

The user can export the wealth development as a PDF report from the existing export dialog, in the same visual style as the income and retirement reports: key figures, the development of the total, the breakdown by class, the snapshot table and the balance sheet of the latest snapshot in the chosen period. The report follows the interface language.

**Why this priority**: Useful for archiving and sharing, but not required to get value from the feature.

**Independent Test**: With several snapshots, export the PDF and verify it contains the key figures, the development, the class breakdown, the balance sheet and all snapshots in the chosen period, with nothing cut off.

**Acceptance Scenarios**:

1. **Given** at least one snapshot, **When** the user exports the PDF, **Then** the report contains the current net worth, the change over the chosen period, the breakdown by class, the snapshot table and the balance sheet.
2. **Given** a period filter is active, **When** the user exports, **Then** the report reflects the same period.
3. **Given** no snapshot, **When** the user opens the export dialog, **Then** the wealth export is unavailable with an explanation.

---

### Edge Cases

- An amount of zero is allowed (the item is still tracked); a negative amount is rejected, liabilities are entered as positive amounts on the liability side.
- A snapshot whose net worth is negative is shown correctly (sign preserved) in totals, chart, tile, balance sheet and PDF; percentage change against a zero or negative previous total is shown as "n/a" instead of a misleading number.
- Very large values (e.g. real estate) and values with decimals are accepted and displayed without rounding errors in totals.
- Two entries with the same name and class in one snapshot are allowed (e.g. two cars named alike) and are both summed.
- A class name used on both sides (e.g. "Other") is kept separate per side; its balance group is chosen from the groups of its side.
- Renaming an asset class in one entry does not silently rename it in other snapshots.
- A snapshot without entries is not saved.
- Many snapshots (e.g. monthly over 10+ years, 120+ points) keep chart and table readable.
- The user's display currency is the one used throughout the app; no per-entry currencies in this version.
- Deleting the last snapshot returns the page and tile to the empty state.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: Users MUST be able to create a snapshot for a reference date, today or in the past, but not in the future.
- **FR-002**: A snapshot MUST contain one or more entries, each with a name, a side (asset or liability), a class and a non-negative monetary amount; the snapshot's net worth is total assets minus total liabilities.
- **FR-003**: The system MUST offer suggested classes per side (assets: cash, precious metals, bank balances, shares/funds, crypto, real estate, vehicles, collectibles, other; liabilities: mortgage, loan, other debt) and MUST also accept any user-defined class name.
- **FR-004**: User-defined classes MUST be offered as suggestions in later entries.
- **FR-005**: There MUST be at most one snapshot per reference date per user; attempts to create a second one MUST be reported and the existing one offered.
- **FR-006**: Users MUST be able to edit and delete snapshots and their entries at any time.
- **FR-007**: Users MUST be able to create a snapshot by copying the entries (name and class, without values) of an existing snapshot.
- **FR-008**: The system MUST show per-class sub-totals, total assets, total liabilities and the net worth for each snapshot.
- **FR-009**: The overview MUST show the net worth over the reference dates in chronological order, independent of creation order.
- **FR-010**: The overview MUST show the development by class, with liabilities shown separately from assets, treating a class absent in a snapshot as zero for that date.
- **FR-011**: The overview MUST show, per snapshot, the absolute and percentage change of the net worth versus the previous snapshot in the chosen period.
- **FR-012**: Users MUST be able to restrict the overview to a period and to show or hide individual asset classes.
- **FR-013**: The overview MUST show helpful empty states for zero snapshots and a hint when only one snapshot exists.
- **FR-014**: The dashboard MUST offer a wealth tile with latest net worth, change versus the previous snapshot and a trend, linking to the page, and it MUST take part in the existing tile ordering and visibility settings.
- **FR-015**: The existing export dialog MUST offer a PDF wealth report in the style of the income and retirement reports, containing key figures, development of the net worth, breakdown by class, the snapshot table and the balance sheet of the latest snapshot in the period, for the chosen period, in the interface language.
- **FR-016**: Wealth data is entered by the user manually; the system MUST NOT fetch values from banks, brokers or other external systems.
- **FR-017**: Entries MUST be validated: required fields present, amount numeric and not negative, date valid and not in the future; errors MUST name the offending field.
- **FR-018**: A user MUST only ever see and change their own snapshots.
- **FR-019**: Wealth figures and entry names MUST be treated as sensitive personal data: stored protected, never written to logs, and covered by the same data-minimization and owner-only rules as the Earnings and Retirement domains.
- **FR-020**: All user-facing text MUST be available in the app's supported interface languages, and interactive elements MUST be reachable by keyboard and have accessible names.
- **FR-021**: Wealth data MUST be removed together with the user's account data on account deletion.
- **FR-022**: Liabilities MUST be visibly distinguishable from assets in the snapshot, the breakdown, the balance sheet and the PDF.
- **FR-023**: The system MUST offer a balance-sheet view for a user-chosen reference date (default: latest snapshot) showing assets grouped by balance group, liabilities grouped by balance group, and the net worth as the balancing equity so that both sides are always equal.
- **FR-024**: Balance groups MUST be: for assets liquid funds, securities and crypto, tangible assets, other; for liabilities short-term, long-term, other.
- **FR-025**: Each class MUST belong to exactly one balance group per user; suggested classes MUST have a default group, user-defined classes MUST be assigned once by the user and remembered, and entries of classes without a group MUST appear under "other".
- **FR-026**: Changing a class's balance group MUST apply to all snapshots, since the group is a property of the class and not of a single entry.
- **FR-027**: The balance sheet MUST NOT compute or display ratios such as equity ratio or liquidity ratio in this version.

### Key Entities

- **Wealth Snapshot**: The user's wealth on one reference date. Attributes: reference date (unique per user), optional note, entries, derived totals.
- **Wealth Entry**: One owned item or one liability within a snapshot. Attributes: free-text name, side (asset or liability), class, non-negative monetary amount.
- **Class**: A label grouping entries on one side, either one of the suggested classes or user-defined. Not a fixed list. Carries the user's balance group for that class.
- **Balance Group**: A fixed structural group of the balance sheet (assets: liquid funds, securities and crypto, tangible assets, other; liabilities: short-term, long-term, other) to which each class is assigned.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A user can record a first snapshot with five entries in under 3 minutes.
- **SC-002**: A user can backfill an additional historic snapshot by copying an existing one in under 1 minute when only values change.
- **SC-003**: The overview with 120 snapshots is usable: chart, breakdown and table appear within 2 seconds and stay readable.
- **SC-004**: 100% of entries with a user-defined class (e.g. whiskey, car) can be saved and appear in totals, breakdown and the PDF.
- **SC-005**: Totals, changes and per-class values in overview, tile, balance sheet and PDF agree for the same period in all cases.
- **SC-006**: A user can go from the dashboard to a PDF of their wealth development in under 30 seconds.
- **SC-007**: No wealth figure or entry name from one user is ever visible to another user.

## Assumptions

- Liabilities are entered as positive amounts on a liability side (decided; replaces the earlier idea of negative values), so the net worth is assets minus liabilities and the balance sheet needs no sign conventions.
- Balance-sheet ratios (equity ratio, liquidity) are deferred; the groups are user-driven and ratios could mislead.
- The feature belongs to the existing, so far placeholder **Historic Wealth Development** domain.
- Values are entered in the user's single display currency (EUR); multi-currency is out of scope.
- Bulk import of historic snapshots from CSV/Excel is **out of scope** for this version (decided); manual backfill with "copy from existing" is the supported route. Import is a candidate follow-up feature.
- A snapshot is a manual point-in-time record; no automatic periodic snapshots and no reminders in this version.
- Taking values over from the Holdings domain is **out of scope** for this version: Holdings has no current market value yet because it is not connected to market prices. It is a natural follow-up once current prices exist; the entry model leaves room for it.
- Items are tracked as individual entries with a name and class; there is no per-item history linking entries across snapshots beyond matching by name and class when copying.
- The overview, tile and PDF reuse the look, period filtering and tile/export mechanisms already established by the Earnings and Retirement domains.
- The constitution's Product Scope will need to name the Historic Wealth Development domain's manual entry and its sensitive-data treatment when this feature is planned.
