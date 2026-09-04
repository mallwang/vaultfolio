# Feature Specification: Deposit Money Asset Type

**Feature Branch**: `018-deposit-money`

**Created**: 2026-09-04

**Status**: Draft

**Input**: User description: "for deposit-money"

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Record a cash balance as a holding (Priority: P1)

A user has cash sitting in a bank account, at home, or as uninvested reference-account balance
with a broker or robo-advisor. Today there is no holding type that fits, so this money is either
left untracked or mislabeled under an unrelated asset type. The user wants to record it as its own
kind of holding through the normal holdings-entry flow.

**Why this priority**: This is the core gap the feature exists to close. Without it, nothing else
in this feature has value — there is no deposit-money holding to display or aggregate.

**Independent Test**: Can be fully tested by opening the holdings-entry flow, selecting the
deposit-money type, entering a name (e.g. "N26 checking"), a managing institution, and a current
value, and saving it — the holding then appears in the user's holdings list with the values
entered.

**Acceptance Scenarios**:

1. **Given** the holdings-entry flow, **When** the user selects the deposit-money asset type,
   **Then** the form asks for a name, a managing institution, and a current value, and does not ask
   for fields that don't apply to cash (e.g. quantity, purchase price, ISIN, weight).
2. **Given** a deposit-money holding is being entered, **When** the user submits without a name or
   without a current value, **Then** the system rejects the submission and identifies which
   required field is missing.
3. **Given** a saved deposit-money holding, **When** the user views their holdings list, **Then**
   the holding appears with its name, managing institution, and current value.

---

### User Story 2 - Update an existing deposit-money balance (Priority: P2)

Cash balances change over time (deposits, withdrawals, interest). The user wants to update the
recorded value of an existing deposit-money holding at a given institution rather than create a
duplicate entry every time the balance changes.

**Why this priority**: Without an update path, the feature only supports a one-time snapshot,
which quickly goes stale and undermines the accuracy goal the feature is meant to serve. It is
second priority because a user can still get initial value from User Story 1 alone.

**Independent Test**: Can be fully tested by re-submitting a deposit-money holding with the same
name and managing institution but a different current value, and confirming the existing holding's
value is replaced rather than a second holding being created.

**Acceptance Scenarios**:

1. **Given** an existing deposit-money holding for a given name and managing institution, **When**
   the user submits a new current value for that same name and institution, **Then** the existing
   holding's value is updated in place rather than a new, separate holding being created.
2. **Given** two deposit-money holdings with the same name but different managing institutions
   (e.g. "Checking" at two different banks), **When** the user updates one, **Then** the other is
   left unchanged.

---

### User Story 3 - See deposit money reflected in overall wealth (Priority: P3)

The user wants their recorded deposit-money holdings to count toward their overall tracked wealth
alongside investment holdings, since cash is fully accessible today and carries no valuation
uncertainty.

**Why this priority**: This is the payoff of tracking deposit money at all, but it depends on User
Story 1 already existing and mainly extends an existing aggregation rather than introducing new
user-facing interaction, so it is lower priority to build/test independently.

**Independent Test**: Can be fully tested by recording one or more deposit-money holdings and
confirming the portfolio/wealth overview's total includes their current values.

**Acceptance Scenarios**:

1. **Given** one or more saved deposit-money holdings, **When** the user views their portfolio
   overview, **Then** the displayed total wealth includes the sum of those holdings' current
   values.
2. **Given** a deposit-money holding, **When** it is included in the overview total, **Then** it is
   distinguishable from investment holdings (e.g. shown under its own asset-type label) rather than
   blended in unlabeled.

### Edge Cases

- What happens when a user enters a current value of zero (an emptied account)? The holding MUST
  still be saved and counted (as zero) rather than rejected — a zero balance is a valid state, not
  an error.
- What happens when a user enters a negative current value? The system MUST reject it, since a cash
  balance cannot be negative in this feature's scope.
- What happens when a user switches an existing holding's asset type away from deposit money to
  something else (e.g. precious metal)? Fields that don't apply to the new type (here, current
  value alone still applies, but the deposit-money identity is lost) MUST be handled the same way
  existing asset-type switches are handled elsewhere in the app — the holding is treated as a new
  holding of the new type.
- How does the system handle two deposit-money holdings with the same name and the same managing
  institution submitted in immediate succession? Per User Story 2, the second submission MUST
  update the first rather than create a duplicate.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The system MUST offer "deposit money" as a selectable asset type when a user creates
  or edits a holding, alongside the existing asset types.
- **FR-002**: For a deposit-money holding, the system MUST require a name (free text, e.g. "N26
  checking" or "Cash at home") and a current value.
- **FR-003**: For a deposit-money holding, the system MUST require the same managing-institution
  field already used by other asset types (e.g. "N26", "Cash" for money not held at an
  institution), to distinguish holdings with the same name at different institutions.
- **FR-004**: For a deposit-money holding, the system MUST NOT require or display fields that don't
  apply to cash — quantity, purchase price, purchase date, ISIN, or weight.
- **FR-005**: The system MUST reject a deposit-money submission that is missing a name or a current
  value, and MUST identify which field is missing.
- **FR-006**: The system MUST reject a negative current value for a deposit-money holding.
- **FR-007**: The system MUST accept a current value of zero for a deposit-money holding.
- **FR-008**: When a user submits a deposit-money holding whose name and managing institution match
  an existing deposit-money holding, the system MUST update that existing holding's current value
  rather than create a new, separate holding.
- **FR-009**: The system MUST include each deposit-money holding's current value in the user's
  overall current-wealth total, on the same basis as existing asset types.
- **FR-010**: The system MUST display deposit-money holdings in the holdings list and portfolio
  overview labeled distinctly as deposit money, not blended unlabeled into another asset type.
- **FR-011**: The system MUST support one-time migration of any existing stored holdings data so
  that the new asset type is recognized without requiring re-entry of unrelated existing holdings.

### Key Entities

- **Deposit-Money Holding**: A holding representing a fiat cash balance the user currently has
  access to (bank account, cash on hand, or an uninvested reference-account balance at a broker or
  robo-advisor). Attributes: name (free text describing the holding), managing institution (which
  bank/provider holds it, or "Cash" when not institution-held), and current value (the balance,
  always zero or positive). Identified for update purposes by the combination of name and managing
  institution.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A user can record a new deposit-money holding, from opening the holdings-entry flow
  to seeing it saved, in under 1 minute.
- **SC-002**: 100% of deposit-money holdings a user has recorded appear in the current-wealth total
  shown on the portfolio overview.
- **SC-003**: Updating an existing deposit-money balance never results in a duplicate holding for
  the same name and managing institution — verified across repeated updates.
- **SC-004**: Users report that their tracked wealth total reflects their actual currently-
  accessible cash, closing a gap that existed before this feature (baseline: cash was untracked or
  mislabeled).

## Assumptions

- A single free-text name field plus the existing managing-institution field is sufficient to
  distinguish deposit-money holdings (e.g. "N26 checking" vs. "Cash at home") without a dedicated
  sub-classification field, consistent with how the existing precious-metal asset type already
  distinguishes holdings by name and institution.
- The existing managing-institution field is reused as-is for deposit money rather than adding a
  dedicated "bank" field, for consistency with all other asset types.
- All values are treated in the application's existing single-currency handling; the app has no
  multi-currency concept today, so deposit money does not introduce one.
- Deposit money is always counted in current-wealth aggregation with no illiquidity or timing
  caveats, because — unlike investment holdings whose access may be restricted — it is accessible
  today.
- Retirement claims and other future-entitlement asset types are out of scope for this feature and
  are tracked separately.
- No live bank or brokerage API integration is introduced; values are entered and updated manually,
  consistent with the product's existing manual-entry-only design.
