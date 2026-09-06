# Feature Specification: Account Overview

**Feature Branch**: `025-account-overview`

**Created**: 2026-09-06

**Status**: Draft

**Input**: User description: "I would like to add the account overview page with some content and features. The main idea was to provide the user a way to list all banks, neobrokers, depots, credit cards and so on to have a central overview about the accounts of the user. I personally use a multi-account model with the following: one general account (salary + fixed costs), one leisure account (variable costs), some saving accounts (roboadvisor, precious metal account, 'Tagesgeld'), one credit card. The user should be able to structure his accounts in this multi-account model or, if not used, store account information as he wishes."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - See a central overview of all accounts (Priority: P1)

As a user with money spread across several banks, brokers, and cards, I want a single page that lists every account I have — its name, provider, category, and current balance — so I can understand my overall financial position at a glance instead of logging into each provider separately.

**Why this priority**: This is the core value of the feature. Without a working list view, there is nothing to build on — every other capability (adding, editing, grouping) only matters because there's an overview to populate and organize.

**Independent Test**: Can be fully tested by seeding a handful of accounts and visiting the overview page — the user sees every account, its category, provider, and balance, plus a combined total, without needing add/edit/delete to be built yet.

**Acceptance Scenarios**:

1. **Given** the user has several accounts already recorded, **When** they open the account overview page, **Then** they see every account listed with its name, category, provider/institution, and current balance.
2. **Given** the user has accounts recorded, **When** they view the overview page, **Then** they see an aggregated total balance across all accounts.
3. **Given** the user has no accounts recorded yet, **When** they open the overview page, **Then** they see a clear empty state that explains how to add their first account.

---

### User Story 2 - Add, edit, and remove accounts (Priority: P2)

As a user, I want to add a new account (e.g., my general account, a savings account, or a credit card), edit its details later, and remove an account I no longer use, so my overview always reflects reality.

**Why this priority**: The overview is only useful if the user can keep it up to date themselves; this is the second most essential slice after simply viewing the list.

**Independent Test**: Can be fully tested by creating an account through a form, confirming it appears on the overview, editing one of its fields and confirming the change is reflected, then deleting it and confirming it disappears.

**Acceptance Scenarios**:

1. **Given** the user is on the overview page, **When** they add a new account with a name, category, provider, and balance, **Then** the account appears in the overview list immediately.
2. **Given** an existing account, **When** the user edits its name, category, provider, or balance, **Then** the overview reflects the updated values.
3. **Given** an existing account, **When** the user deletes it, **Then** it no longer appears in the overview and is excluded from the aggregated total.
4. **Given** the user submits a new account without a name, **When** they try to save, **Then** the system rejects the submission and explains what is missing.

---

### User Story 3 - Structure accounts using a multi-account model, or not (Priority: P3)

As a user who deliberately splits money across a general account, a leisure account, several savings accounts, and a credit card, I want to categorize each account accordingly and see them grouped on the overview — but as a user who doesn't think in those terms, I want to be equally free to just add accounts without fitting them into that structure.

**Why this priority**: This turns the overview from a flat list into something that mirrors how many users actually organize their money, but the feature is still useful (per US1/US2) without it, so it's the refinement layer rather than the core.

**Independent Test**: Can be fully tested by creating accounts under different categories (including a custom/uncategorized one) and confirming the overview can group or filter by category, while an account left uncategorized still displays normally alongside the rest.

**Acceptance Scenarios**:

1. **Given** the user is adding or editing an account, **When** they reach the category field, **Then** they can choose from common categories (e.g., General, Leisure, Savings, Credit Card) or leave it as a generic/custom category.
2. **Given** accounts exist across multiple categories, **When** the user views the overview, **Then** accounts are grouped (or filterable) by category, with a subtotal per category.
3. **Given** a user who does not want to categorize their accounts, **When** they add accounts without picking a specific category, **Then** all such accounts still appear together in the overview under a default/uncategorized grouping, with no loss of functionality.

---

### Edge Cases

- What happens when a user adds an account with a negative balance (e.g., an outstanding credit card balance)? The system must accept it and reflect it correctly in totals rather than rejecting it.
- What happens when a user creates two accounts with the same name (e.g., two accounts both called "Savings")? The system must allow it, since the same institution/category combination could legitimately repeat (e.g., two savings accounts at different banks).
- How does the overview behave when every account is left in the default/uncategorized grouping? It must still display a single, ungrouped list plus the total, with no visual clutter from an empty category structure.
- What happens when a user deletes the last account? The overview must fall back to the empty state described in User Story 1.
- What happens when a balance is left blank at creation time? The account must still be created and shown, with its balance treated as unknown/zero for totals rather than blocking creation.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST provide a dedicated account overview page listing every account the user has recorded.
- **FR-002**: Each account entry on the overview MUST display, at minimum: account name, category, provider/institution name, and current balance.
- **FR-003**: Users MUST be able to create a new account by providing a name and, optionally, a category, provider/institution name, and balance.
- **FR-004**: Users MUST be able to edit any field of an existing account.
- **FR-005**: Users MUST be able to delete an existing account, with confirmation before the deletion is applied.
- **FR-006**: System MUST reject an account create/edit submission that has an empty name, and MUST tell the user why it was rejected.
- **FR-007**: System MUST offer a predefined set of categories that reflect a common multi-account model (General, Leisure, Savings, Credit Card) plus a generic/custom category for accounts that don't fit those labels.
- **FR-008**: System MUST NOT require a user to categorize their accounts — leaving the category as the generic/custom option MUST be fully supported and MUST NOT degrade any overview functionality.
- **FR-009**: Overview page MUST group accounts by category (or offer a way to filter by category), including a group for uncategorized/custom accounts.
- **FR-010**: Overview page MUST display an aggregated total balance across all accounts, and a subtotal per category group.
- **FR-011**: System MUST allow a balance to be a positive, negative, or blank value (blank is treated as zero for aggregation) to support liability-style accounts such as credit cards.
- **FR-012**: System MUST display a clear empty state on the overview page when the user has no accounts recorded yet, with a direct path to add the first one.
- **FR-013**: Account balances MUST be manually entered and edited by the user; this feature does not connect to external bank/broker systems to fetch live data.

### Key Entities

- **Account**: Represents one bank, neobroker, depot, credit card, or similar holding container the user tracks. Attributes: unique identifier, name (user-chosen, required), category (one of the predefined multi-account categories or a generic/custom value), provider/institution name (optional, free text), current balance (optional signed decimal amount), notes (optional free text), created/updated timestamps.
- **Account Category**: A label used to group accounts to mirror the user's multi-account model (e.g., General, Leisure, Savings, Credit Card) or a generic/custom bucket for users who don't use that structure. Not a rigid classification — a small, extensible set of labels rather than a strict taxonomy.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A user can see their complete account picture — every account plus a combined total balance — on a single page without navigating elsewhere.
- **SC-002**: A user can add a new account to the overview in under one minute.
- **SC-003**: 100% of accounts a user creates, edits, or deletes are reflected on the overview page immediately, with no manual refresh needed.
- **SC-004**: A user who does not use the multi-account model can still record and view all their accounts without being forced to pick a category, with zero loss of information or function compared to a user who does categorize.
- **SC-005**: A user who does use the multi-account model can identify, within a few seconds of looking at the page, how much money sits in each category (e.g., "how much is in savings").

## Assumptions

- Account balances are entered and maintained manually by the user; no integration with external banking/brokerage APIs is in scope for this feature.
- A single, implicit base currency is assumed across all accounts, consistent with how the existing holdings feature has no per-item currency field — multi-currency support is out of scope for this iteration.
- The predefined category set (General, Leisure, Savings, Credit Card, plus a generic/custom option) is a starting point drawn from the feature request; it is treated as an extensible list of labels rather than a fixed enum baked permanently into the domain.
- This feature introduces a new "Account" concept that is independent of the existing Holding entity and its free-text "management" field (used by the manual holdings-entry feature); linking individual holdings to a specific account is not part of this feature's scope, though it may be considered later.
- No additional authentication or per-user data separation is introduced beyond whatever boundary the application already establishes (consistent with the existing holdings feature).
- Deleting an account removes it and its balance from the overview and totals; it does not attempt to reconcile or migrate any holdings that may have been informally associated with it via free text elsewhere in the app.
