# Feature Specification: Frontend Shell Extension Points

**Feature Branch**: `021-frontend-extension-points`

**Created**: 2026-09-05

**Status**: Draft

**Input**: User description: "Frontend shell extension points: extract Imports into the Holdings domain as an internal tab (remove its standalone sidebar entry), separate Admin/Verwaltung into its own role-gated module apart from the domain-entitlement model, and give the Dashboard and Settings areas a per-domain extension mechanism so each domain library can contribute its own dashboard widget (e.g. Holdings' distribution card) and/or its own settings tab, filtered by domain entitlement, without domain-access (scope:shared) depending on any scope:frontend-domain library."

**Origin**: This spec is the direct follow-up to [020-domain-library-architecture](../020-domain-library-architecture/spec.md), which established the domain-library structure, its boundary enforcement, and the shared entitlements mechanism for holdings as the first domain. That work deliberately left the app-shell's Dashboard, Settings, and navigation still hard-wired to holdings-specific code, and left "Imports" and "Verwaltung" (Admin) as shell-owned areas. This spec closes those gaps so the shell stops accumulating domain-specific knowledge as further domains (retirement, insurances, household planning, historic wealth development, account overview) are added.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - A domain's dashboard contribution moves with the domain (Priority: P1)

Today the app-shell's Dashboard hard-codes an import of Holdings' distribution-by-type widget directly into its own code. As more domains are added, each one that wants a dashboard presence would otherwise require the shell to be edited and redeployed with more hard-coded, domain-specific imports — exactly the coupling the domain-library structure was meant to prevent. The team needs the Dashboard to display whichever widgets the domains the current user is entitled to choose to contribute, without the shell needing to know each domain's internal component in advance.

**Why this priority**: This is the highest-value, highest-risk item — it re-introduces, for the Dashboard specifically, the exact coupling problem User Story 1 of 020 solved for routing. Getting it right (without breaking the existing Holdings distribution card that already works today) validates the pattern for every other extension point in this spec.

**Independent Test**: Can be fully tested by confirming the Dashboard still shows the Holdings distribution card unchanged for an entitled user, then adding a second throwaway domain with its own dashboard contribution and confirming it appears for an entitled user and is absent for a user without that domain's entitlement — without editing the Dashboard's own code for the second domain.

**Acceptance Scenarios**:

1. **Given** a user entitled to the holdings domain, **When** they view the Dashboard, **Then** the holdings distribution widget appears exactly as it does today.
2. **Given** a user not entitled to a domain that contributes a dashboard widget, **When** they view the Dashboard, **Then** that domain's widget does not appear.
3. **Given** a domain library that contributes a dashboard widget, **When** a developer registers that contribution, **Then** no code within another domain library, or within the Dashboard's own feature logic, needs to change.
4. **Given** a user entitled to no domain that contributes a widget, **When** they view the Dashboard, **Then** the Dashboard still renders its non-domain-specific content (e.g., placeholder summary cards) without error or empty gaps.

---

### User Story 2 - A domain's settings contribution moves with the domain (Priority: P1)

Settings today offers a fixed set of tabs (Profile, Preferences) available to every signed-in user. Some domains will need their own domain-specific settings (e.g., a display preference specific to how a domain presents its data). The team needs Settings to show a standard set of tabs to everyone, plus one additional tab per domain the user is entitled to that actually offers domain-specific settings — without the shell needing to know in advance which domains will ever add one.

**Why this priority**: Equal priority to User Story 1 — it is the same extension-point pattern applied to a second shell area, and both are needed before the next real domain is built to prove the mechanism generalizes (per 020's SC-004 spirit).

**Independent Test**: Can be fully tested by confirming Profile and Preferences remain available to every signed-in user, then adding a throwaway domain with its own settings tab and confirming the tab appears only for an entitled user and navigates to that domain's settings content, without editing Settings' own code for the second domain.

**Acceptance Scenarios**:

1. **Given** any signed-in user, **When** they open Settings, **Then** Profile and Preferences are available exactly as today, regardless of domain entitlements.
2. **Given** a user entitled to a domain that offers its own settings, **When** they open Settings, **Then** that domain's settings tab appears alongside the standard tabs.
3. **Given** a user not entitled to a domain that offers its own settings, **When** they open Settings, **Then** that domain's settings tab does not appear.
4. **Given** a user directly visits the URL of a domain-specific settings tab they are not entitled to, **When** the page loads, **Then** they are denied the same way an unentitled user is denied a domain's main route today.
5. **Given** a domain library that does not offer any domain-specific settings, **When** a user entitled to that domain opens Settings, **Then** no extra tab appears for it (contributing a settings tab is optional per domain).

---

### User Story 3 - Imports lives inside Holdings, not as its own navigation item (Priority: P2)

"Imports" is currently its own top-level navigation entry and route, separate from Holdings, even though its only purpose is importing holdings data. The team needs it to live inside the Holdings domain as an internal tab, so a user goes to Holdings to both view and import their holdings, and the navigation stops listing an area that is not a domain in its own right.

**Why this priority**: Lower risk and narrower blast radius than User Stories 1-2 (it touches one domain and one nav entry, not a new cross-domain mechanism), but still delivers a concrete simplification and is a natural, low-risk first user of any tab-related pattern introduced by User Story 2.

**Independent Test**: Can be fully tested by confirming the standalone "Imports" navigation entry and its top-level route are gone, and that the same import functionality is reachable as a tab from within Holdings, for a user entitled to holdings.

**Acceptance Scenarios**:

1. **Given** a user entitled to the holdings domain, **When** they view the app navigation, **Then** no separate "Imports" entry appears, only "Holdings".
2. **Given** a user entitled to the holdings domain, **When** they open Holdings, **Then** an "Imports" tab is available alongside the holdings list.
3. **Given** a user not entitled to the holdings domain, **When** they view the app navigation or attempt to reach the import functionality directly, **Then** they are denied the same way they are denied the rest of Holdings today.
4. **Given** the previous standalone `/app/imports` address, **When** a user with an existing bookmark or link visits it, **Then** they land on the equivalent location inside Holdings rather than a broken or missing page.

---

### User Story 4 - Verwaltung (Admin) is a clearly separate concern from product domains (Priority: P3)

Admin ("Verwaltung") today lives directly under the app-shell alongside product-domain concerns, gated by the Administrator role rather than by domain entitlement. As the domain-library structure matures, the team needs Admin's code to be organized as its own clearly bounded module — reflecting that it is a role-gated back-office area, not a product domain a user opts into — so it is not mistaken for, or accidentally entangled with, a product domain as more are added.

**Why this priority**: Lowest priority — it is an organizational clarification with no user-facing behavior change (Admin already loads its code only when an Administrator navigates there), so it carries the least urgency and risk of the four stories.

**Independent Test**: Can be fully tested by confirming every existing Admin flow (Accounts, Sign-ups, Invitations, General/health-status) works unchanged for an Administrator, that a non-Administrator still cannot reach or see any of it, and that Admin's code is organized separately from both the app-shell's core layout code and from any product-domain library.

**Acceptance Scenarios**:

1. **Given** an Administrator, **When** they use every existing Admin flow (Accounts, Sign-ups, Invitations, General), **Then** behavior is unchanged from before this change.
2. **Given** a non-Administrator user, **When** they view the navigation or attempt to reach an Admin address directly, **Then** they are denied exactly as today.
3. **Given** the reorganized codebase, **When** a developer inspects it, **Then** Admin's code is clearly identifiable as a distinct module from both the app-shell's core layout and any product-domain library, and is not gated by the domain-entitlement mechanism.

---

### Edge Cases

- What happens when a domain contributes a dashboard widget or settings tab but the user loses entitlement to that domain mid-session? The contribution MUST stop appearing on the next navigation/route evaluation, consistent with how the domain's main navigation entry and route already behave today (per 020's existing session-refresh assumption).
- What happens when a domain contributes more than one dashboard widget, or none at all? The mechanism MUST support a domain contributing zero or one dashboard widget and zero or one settings tab for this spec's scope (see Assumptions); contributing multiple of either is out of scope.
- What happens when two domains each contribute a dashboard widget? Both MUST appear (for a user entitled to both), in a stable, predictable order, without either domain's code needing to know about the other.
- What happens to a bookmarked pre-change `/app/imports` link? It MUST continue to work by redirecting to the equivalent location inside Holdings, consistent with how prior restructures in this codebase have preserved legacy addresses.
- What happens when an Administrator is also entitled to zero product domains? They MUST still retain full access to Admin ("Verwaltung"), since Admin access is role-based, not domain-entitlement-based.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The system MUST allow a domain library to optionally contribute one dashboard widget, displayed on the app's Dashboard only to users entitled to that domain.
- **FR-002**: The system MUST allow a domain library to optionally contribute one settings tab, displayed in the app's Settings area only to users entitled to that domain.
- **FR-003**: Registering a domain's dashboard widget or settings tab contribution MUST NOT require changes to another domain's code, tests, or deploy path (consistent with 020's FR-011).
- **FR-004**: The mechanism used to decide whether a domain's dashboard widget or settings tab is shown MUST be the same shared entitlements mechanism already used for that domain's navigation entry and route guard (020's FR-004), so a user can never see a domain-specific dashboard widget or settings tab for a domain they cannot otherwise access, or vice versa.
- **FR-005**: The Dashboard MUST continue to display the holdings distribution widget, unchanged in appearance and behavior, as a contribution from the holdings domain under the new mechanism.
- **FR-006**: The Settings area MUST continue to offer Profile and Preferences to every signed-in user regardless of domain entitlements, in addition to any domain-contributed tabs.
- **FR-007**: The system MUST NOT require the shared entitlements mechanism (020's cross-domain access-control library) to depend on any individual domain library's internal or public code, in order to support dashboard widget or settings tab contributions.
- **FR-008**: The Holdings domain's existing import functionality MUST be reachable as a tab within the Holdings area rather than as a separate top-level navigation entry.
- **FR-009**: The app's navigation MUST NOT display a standalone "Imports" entry after this change.
- **FR-010**: A pre-existing address for the standalone Imports page MUST continue to resolve (via redirect) to the equivalent location inside Holdings.
- **FR-011**: Access to the Imports tab within Holdings MUST be governed by the same entitlement check as the rest of the holdings domain — no separate access rule.
- **FR-012**: The system MUST organize Admin ("Verwaltung") functionality as a distinct module, structurally separate from both the app-shell's core layout/navigation code and from any product-domain library.
- **FR-013**: Admin's access control MUST remain role-based (Administrator), and MUST NOT be changed to use the domain-entitlement mechanism.
- **FR-014**: All existing Admin functionality (Accounts, Sign-ups, Invitations, General/health-status) MUST continue to work unchanged for Administrators after this reorganization.
- **FR-015**: All existing Holdings functionality (view, create, edit, delete, import, distribution chart) MUST continue to work unchanged for users entitled to holdings after this change.

### Key Entities

- **Dashboard Widget Contribution**: An optional piece of Dashboard content a domain library supplies. Associated with exactly one domain; shown only to users entitled to that domain; the Dashboard hosts an ordered collection of these without needing to know each one's internal implementation.
- **Settings Tab Contribution**: An optional additional Settings tab a domain library supplies, alongside the standard tabs (Profile, Preferences) every signed-in user always has. Associated with exactly one domain; shown only to users entitled to that domain.
- **Imports (relocated)**: The existing holdings-data-import functionality, now represented as a tab within the Holdings domain area rather than as its own navigation entry and route.
- **Verwaltung / Admin Module**: The existing role-gated back-office area (Accounts, Sign-ups, Invitations, General), reorganized into its own clearly bounded module, distinct from both the app-shell and any product-domain library, and continuing to use role-based (not domain-entitlement-based) access control.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A team member can add a new domain's dashboard widget or settings tab by touching only that domain's code plus one well-known registration point, without modifying the Dashboard's, Settings', or another domain's own feature logic.
- **SC-002**: Every existing Holdings user flow (create, edit, delete, import, view distribution chart) passes its existing acceptance criteria unchanged after this change — zero functional regressions.
- **SC-003**: Every existing Admin user flow (Accounts, Sign-ups, Invitations, General) passes its existing acceptance criteria unchanged after this change — zero functional regressions.
- **SC-004**: The app navigation lists exactly one entry for holdings-related functionality (no separate Imports entry) for a user entitled to holdings.
- **SC-005**: A user who is not entitled to a domain never sees that domain's dashboard widget or settings tab, in 100% of observed cases, and a user who is entitled always sees them.
- **SC-006**: A pre-change bookmark to the standalone Imports address continues to land the user on working, equivalent functionality 100% of the time.

## Assumptions

- This spec covers at most one dashboard widget and at most one settings tab per domain; a domain contributing multiple of either, or richer widget layout/sizing controls, is out of scope and left to a future spec if the need arises.
- The existing session-refresh timing assumption from 020 (entitlement changes take effect on next navigation/route evaluation, not instant server push) applies unchanged to dashboard widgets and settings tabs.
- "Verwaltung" (Admin) is treated as a role-gated back-office module, not a product domain; it is explicitly excluded from the domain-entitlement mechanism used for holdings and future product domains. If the team later wants Admin itself to be entitlement-scoped (e.g., per-account admin delegation), that is a separate decision left to a future spec.
- The holdings distribution widget currently shown on the Dashboard is retrofitted to use the new contribution mechanism as the proof this pattern works, mirroring how holdings itself was the proof case for 020.
- No new domains beyond holdings are built as part of this spec; this spec only builds the extension points and retrofits holdings (and Imports, and Admin's reorganization) to prove they work, consistent with 020's precedent of leaving future domains to later specs.
- The application remains a single deployable artifact; this change introduces no new build or deployment steps (consistent with 020's FR-010).
