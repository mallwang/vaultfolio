# Feature Specification: Account Overview

**Feature Branch**: `025-account-overview`

**Created**: 2026-09-06

**Status**: Draft

**Design**: [design.md](design.md)

**Input**: User description: "I would like to add the account overview page with some content and features. The main idea was to provide the user a way to list all banks, neobrokers, depots, credit cards and so on to have a central overview about the accounts of the user. I personally use a multi-account model with the following: one general account (salary + fixed costs), one leisure account (variable costs), some saving accounts (roboadvisor, precious metal account, 'Tagesgeld'), one credit card. The user should be able to structure his accounts in this multi-account model or, if not used, store account information as he wishes."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - See a central reference of all accounts (Priority: P1)

As a user with money spread across several banks, brokers, and cards, I want a single page that lists every account I have — its name, provider, category, purpose, and any other details I've noted about it (like how I use its card, or a minimum balance to keep in it) — so I can remind myself what each account is for and where to find it, without digging through emails or bookmarks.

**Why this priority**: This is the core value of the feature. Without a working list view, there is nothing to build on — every other capability (adding, editing, grouping) only matters because there's an overview to populate and organize. This is a reference directory, not a financial dashboard — it does not track or total any money.

**Independent Test**: Can be fully tested by seeding a handful of accounts and visiting the overview page — the user sees every account, its category, provider (with a link to the provider's site, when given), purpose, and any noted details, without needing add/edit/delete to be built yet.

**Acceptance Scenarios**:

1. **Given** the user has several accounts already recorded, **When** they open the account overview page, **Then** they see every account listed with its name, category, provider/institution (linked to its website when one is recorded), and purpose.
2. **Given** an account has additional details recorded (e.g. how its card is used, or a required minimum balance), **When** the user views the overview page, **Then** those details are visible alongside the account.
3. **Given** the user has no accounts recorded yet, **When** they open the overview page, **Then** they see a clear empty state that explains how to add their first account.

---

### User Story 2 - Add, edit, and remove accounts (Priority: P2)

As a user, I want to add a new account (e.g., my general account, a savings account, or a credit card), edit its details later, and remove an account I no longer use, so my overview always reflects reality.

**Why this priority**: The overview is only useful if the user can keep it up to date themselves; this is the second most essential slice after simply viewing the list.

**Independent Test**: Can be fully tested by creating an account through a form, confirming it appears on the overview, editing one of its fields and confirming the change is reflected, then deleting it and confirming it disappears.

**Acceptance Scenarios**:

1. **Given** the user is on the overview page, **When** they add a new account with a name and, optionally, a category, provider, website, purpose, and other details, **Then** the account appears in the overview list immediately.
2. **Given** an existing account, **When** the user edits any of its fields, **Then** the overview reflects the updated values.
3. **Given** an existing account, **When** the user deletes it, **Then** it no longer appears in the overview.
4. **Given** the user submits a new account without a name, **When** they try to save, **Then** the system rejects the submission and explains what is missing.

---

### User Story 3 - Structure accounts using a multi-account model, or not (Priority: P3)

As a user who deliberately splits money across a general account, a leisure account, several savings accounts, and a credit card, I want to categorize each account accordingly and see them grouped on the overview — but as a user who doesn't think in those terms, I want to be equally free to just add accounts without fitting them into that structure.

**Why this priority**: This turns the overview from a flat list into something that mirrors how many users actually organize their money, but the feature is still useful (per US1/US2) without it, so it's the refinement layer rather than the core.

**Independent Test**: Can be fully tested by creating accounts under different categories (including a custom/uncategorized one) and confirming the overview can group or filter by category, while an account left uncategorized still displays normally alongside the rest.

**Acceptance Scenarios**:

1. **Given** the user is adding or editing an account, **When** they reach the category field, **Then** they can choose from common categories (e.g., General, Leisure, Savings, Credit Card) or leave it as a generic/custom category.
2. **Given** accounts exist across multiple categories, **When** the user views the overview, **Then** accounts are grouped (or filterable) by category, with a count of accounts per group.
3. **Given** a user who does not want to categorize their accounts, **When** they add accounts without picking a specific category, **Then** all such accounts still appear together in the overview under a default/uncategorized grouping, with no loss of functionality and no empty category headers cluttering the page.

---

### Edge Cases

- What happens when a user creates two accounts with the same name (e.g., two accounts both called "Savings")? The system must allow it, since the same institution/category combination could legitimately repeat (e.g., two savings accounts at different banks).
- How does the overview behave when every account is left in the default/uncategorized grouping? It must still display a single, ungrouped list, with no visual clutter from an empty category structure.
- What happens when a user deletes the last account? The overview must fall back to the empty state described in User Story 1.
- What happens when optional fields (provider, website, purpose, or any other detail) are left blank? The account must still be created and shown, simply omitting whichever fields were not filled in.
- What happens when a recorded website link is malformed or unreachable? The system must still display and save it as entered; it is not validated as a live, reachable address.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST provide a dedicated account overview page listing every account the user has recorded.
- **FR-002**: Each account entry on the overview MUST display, at minimum: account name and category. When recorded, it MUST also display the provider/institution name (linked to its website, if a website is recorded), a purpose description, and any other free-text details noted for that account (e.g., how its card is used, a required/minimum balance to maintain).
- **FR-003**: Users MUST be able to create a new account by providing a name and, optionally, a category, provider/institution name, website link, purpose, and any other free-text details.
- **FR-004**: Users MUST be able to edit any field of an existing account.
- **FR-005**: Users MUST be able to delete an existing account, with confirmation before the deletion is applied.
- **FR-006**: System MUST reject an account create/edit submission that has an empty name, and MUST tell the user why it was rejected.
- **FR-007**: System MUST offer a predefined set of categories that reflect a common multi-account model (General, Leisure, Savings, Credit Card) plus a generic/custom category for accounts that don't fit those labels.
- **FR-008**: System MUST NOT require a user to categorize their accounts — leaving the category as the generic/custom option MUST be fully supported and MUST NOT degrade any overview functionality.
- **FR-009**: Overview page MUST group accounts by category (or offer a way to filter by category), including a group for uncategorized/custom accounts, and MUST show how many accounts are in each group.
- **FR-010**: System MUST allow a small set of free-text detail fields per account (e.g., how a card tied to the account is used, a required/minimum balance to keep in it) in addition to a general notes field, so users can record whatever context matters to them about that account, consistent with the feature's "store account information as he wishes" goal.
- **FR-011**: System MUST display a clear empty state on the overview page when the user has no accounts recorded yet, with a direct path to add the first one.
- **FR-012**: This feature is a static reference directory: it does not track, display, or total any monetary balances, and does not connect to external bank/broker systems to fetch live data.

### Key Entities

- **Account**: Represents one bank, neobroker, depot, credit card, or similar container the user tracks for reference. Attributes: unique identifier, name (user-chosen, required), category (one of the predefined multi-account categories or a generic/custom value), provider/institution name (optional, free text), website/homepage link (optional URL, shown as a link on the provider name when present), purpose (optional free text describing what the account is for), a small set of named detail fields such as card usage and required/minimum balance (optional free text each), general notes (optional free text), created/updated timestamps.
- **Account Category**: A label used to group accounts to mirror the user's multi-account model (e.g., General, Leisure, Savings, Credit Card) or a generic/custom bucket for users who don't use that structure. Not a rigid classification — a small, extensible set of labels rather than a strict taxonomy.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A user can see their complete account picture — every account, what it's for, and how to reach its provider — on a single page without navigating elsewhere.
- **SC-002**: A user can add a new account to the overview in under one minute.
- **SC-003**: 100% of accounts a user creates, edits, or deletes are reflected on the overview page immediately, with no manual refresh needed.
- **SC-004**: A user who does not use the multi-account model can still record and view all their accounts without being forced to pick a category, with zero loss of information or function compared to a user who does categorize.
- **SC-005**: A user who does use the multi-account model can identify, within a few seconds of looking at the page, which accounts belong to each category and how many there are.

## Assumptions

- This feature is a static reference/directory, not a financial dashboard: it deliberately does not track, display, or total any account balances, income, or expenses. Any such tracking is out of scope.
- The predefined category set (General, Leisure, Savings, Credit Card, plus a generic/custom option) is a starting point drawn from the feature request; it is treated as an extensible list of labels rather than a fixed enum baked permanently into the domain.
- The named detail fields called out in the request ("bank card usage", "required amount") are treated as example free-text fields rather than a fixed, validated schema — the underlying need is for the user to record whatever context matters to them about an account, per the original request's "store account information as he wishes."
- This feature introduces a new "Account" concept that is independent of the existing Holding entity and its free-text "management" field (used by the manual holdings-entry feature); linking individual holdings to a specific account is not part of this feature's scope, though it may be considered later.
- No additional authentication or per-user data separation is introduced beyond whatever boundary the application already establishes (consistent with the existing holdings feature).
- A recorded website link is stored and displayed as entered; it is not validated as reachable or checked for a live connection.
