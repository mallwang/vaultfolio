# Feature Specification: Klaro Navigation Entry

**Feature Branch**: `028-klaro-nav-integration`

**Created**: 2026-09-08

**Status**: Draft

**Input**: User description: "I would like to enhance the application with a new navigation item (similar like holdings) for "Klaro" (see https://github.com/mallwang/klaro), which is currently a standalone application also developed by me. The side-nav should show the "Klaro" logo instead of any random icon. The page content should show what Klaro is and that its currently in its own standalone application and show a link to the external website (https://klaro.allwang.family/). It should also list that in the future all funcionalities of Klaro will be integrated into Vaultfolio under this navigation point, but currently users need to create their separate user in Klaro and can later synchronize their data, the requirement is that they use the identical email address in both applications."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Discover Klaro from the side navigation (Priority: P1)

A signed-in Vaultfolio user browsing the side navigation notices a new entry for "Klaro", recognizable by Klaro's own logo rather than a generic icon, alongside the other domain entries (e.g. Holdings). Selecting it takes them to a dedicated page introducing Klaro.

**Why this priority**: This is the entire feature — without a discoverable, correctly-branded navigation entry, none of the informational content is reachable.

**Independent Test**: Can be fully tested by signing in, opening the side navigation, confirming a "Klaro" entry with the Klaro logo is present, and selecting it to land on the Klaro information page.

**Acceptance Scenarios**:

1. **Given** a signed-in user viewing the side navigation, **When** they look at the list of navigation entries, **Then** they see an entry labeled "Klaro" displaying the Klaro logo (not a generic/placeholder icon).
2. **Given** a signed-in user viewing the side navigation, **When** they select the "Klaro" entry, **Then** they are taken to a Klaro information page within Vaultfolio.

---

### User Story 2 - Understand what Klaro is and how to reach it (Priority: P1)

On the Klaro information page, a user reads a plain-language explanation of what Klaro does, learns that it currently runs as its own standalone application separate from Vaultfolio, and can follow a link to open the external Klaro application in a new context.

**Why this priority**: Explaining what Klaro is and providing the way to actually use it (the external link) is the core value the page must deliver on day one, since no functionality is embedded yet.

**Independent Test**: Can be fully tested by navigating to the Klaro page, verifying the descriptive content is present, and confirming the external link opens the Klaro application at https://klaro.allwang.family/.

**Acceptance Scenarios**:

1. **Given** a user on the Klaro information page, **When** they read the page content, **Then** they see a description of what Klaro is and does, and a clear statement that it is currently a separate, standalone application from Vaultfolio.
2. **Given** a user on the Klaro information page, **When** they select the external link, **Then** the Klaro application opens at https://klaro.allwang.family/ in a new browser tab, leaving their Vaultfolio session intact.

---

### User Story 3 - Understand the account and data-sync relationship between Vaultfolio and Klaro (Priority: P2)

A user reads on the Klaro page that Klaro functionality will eventually be integrated directly into Vaultfolio under this same navigation entry, but that today they must create their own separate account in Klaro, and that they can later synchronize their Klaro data with Vaultfolio provided they use the identical email address for both accounts.

**Why this priority**: This sets correct expectations and prevents user confusion or duplicate/mismatched accounts, but the page remains useful (via User Story 2) even before this explanation is read in full.

**Independent Test**: Can be fully tested by navigating to the Klaro page and verifying the presence of statements describing: (a) the future integration plan, (b) the current requirement to sign up separately in Klaro, and (c) the same-email-address requirement for future data synchronization.

**Acceptance Scenarios**:

1. **Given** a user on the Klaro information page, **When** they read the page content, **Then** they see a statement that Klaro's functionality is planned to be integrated into Vaultfolio under this navigation entry in the future.
2. **Given** a user on the Klaro information page, **When** they read the page content, **Then** they see a statement that, until that integration happens, they must create a separate account directly in Klaro to use it.
3. **Given** a user on the Klaro information page, **When** they read the page content, **Then** they see a statement that future data synchronization between the two applications will require using the identical email address for both their Vaultfolio and Klaro accounts.

---

### Edge Cases

- What happens if the Klaro logo asset fails to load? The navigation entry MUST still render (e.g. with an accessible text fallback/alt text) and remain selectable — a broken image MUST NOT hide or disable the entry.
- What happens if a user without any entitlement/access to this navigation entry tries to reach the Klaro page directly (e.g. via a bookmarked URL)? The system MUST apply the same access rules used for other domain navigation entries.
- What happens on very small screens / collapsed side navigation? The Klaro entry MUST follow the same responsive/collapsed behavior (e.g. icon-only display) as other navigation entries such as Holdings.
- What happens if the external Klaro site is unreachable when a user selects the link? The link MUST still be followed as a normal outbound link; Vaultfolio is not responsible for the availability of the external site and MUST NOT block or error on this within the Vaultfolio UI itself.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The side navigation MUST include a new entry labeled "Klaro", positioned and behaving consistently with existing domain navigation entries (e.g. Holdings).
- **FR-002**: The Klaro navigation entry MUST display the Klaro application's own logo instead of a generic or placeholder icon.
- **FR-003**: Selecting the Klaro navigation entry MUST open a dedicated Klaro information page within Vaultfolio.
- **FR-004**: The Klaro information page MUST present a plain-language description of what Klaro is and what it is used for.
- **FR-005**: The Klaro information page MUST state that Klaro currently operates as its own standalone application, separate from Vaultfolio.
- **FR-006**: The Klaro information page MUST provide a link to the external Klaro application at https://klaro.allwang.family/, and selecting it MUST open the external site without disrupting the user's active Vaultfolio session (e.g. by opening in a new tab).
- **FR-007**: The Klaro information page MUST state that Klaro's functionality is planned to be integrated into Vaultfolio in the future, under this same navigation entry.
- **FR-008**: The Klaro information page MUST state that, until that integration is complete, users need to create and use a separate account directly within Klaro.
- **FR-009**: The Klaro information page MUST state that Vaultfolio and Klaro accounts can be synchronized in the future, and that doing so will require the user to use the identical email address for both accounts.
- **FR-010**: The Klaro navigation entry MUST respect the same access-control/entitlement rules applied to other domain navigation entries, so that only users entitled to see it are shown or able to reach it.
- **FR-011**: The Klaro information page MUST NOT expose, request, or process any actual Klaro account data (e.g. contracts, credentials) within Vaultfolio — it is purely informational and a signpost to the external application in this iteration.

### Key Entities

- **Klaro Navigation Entry**: The side-navigation item representing the Klaro domain — includes a label ("Klaro"), the Klaro logo, and a target link to the in-app information page.
- **Klaro Information Page**: The in-app page reachable from the navigation entry — includes descriptive content about Klaro, the standalone-application notice, the external link, and the future-integration/account-sync explanation.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A first-time visitor to the Klaro information page can, within 30 seconds of reading, correctly state (a) what Klaro is used for, (b) that it is a separate application today, and (c) that same-email-address accounts are required for future data sync.
- **SC-002**: 100% of users entitled to the Klaro navigation entry can locate it in the side navigation and reach the Klaro information page in one selection, without any additional guidance.
- **SC-003**: Selecting the external Klaro link successfully opens the external Klaro application for 100% of users with a working internet connection, without any error or disruption inside Vaultfolio.
- **SC-004**: The Klaro navigation entry is visually distinguishable from every other navigation entry by its logo alone, without needing to read the label.

## Assumptions

- The Klaro navigation entry is available to the same set of users (all signed-in users, or the same entitlement rules as other domains such as Holdings) unless a future feature introduces domain-specific entitlement for Klaro; this feature does not add new access-control logic beyond reusing the existing per-domain entitlement mechanism.
- "Similar like Holdings" is interpreted as: same navigation placement pattern, same responsive/collapsed behavior, and same page-shell/layout conventions as the Holdings domain entry — not that Klaro reuses any Holdings-specific functionality or data.
- The Klaro logo asset (brand mark) will be sourced from the Klaro project (https://github.com/mallwang/klaro) and made available for use in Vaultfolio's navigation; obtaining/preparing that asset file is an implementation detail handled during planning, not a specification concern.
- This feature is purely informational/signpost in nature — it does not implement any account synchronization mechanism, single sign-on, or data transfer between Vaultfolio and Klaro. The "future integration" and "future synchronization" statements are descriptive/marketing copy on the page, not functionality delivered by this feature.
- The external link opens in a new browser tab/window, consistent with standard practice for outbound links to a separate application.
- No new backend API, data storage, or user-facing settings are required for this feature; it is a frontend-only navigation entry and static informational page.
