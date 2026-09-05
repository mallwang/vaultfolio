# Feature Specification: Placeholder Domains for the Multi-Domain Pivot

**Feature Branch**: `022-add-domain-placeholders`

**Created**: 2026-09-05

**Status**: Draft

**Input**: User description: "I would like to add multiple more domains (alongside the holdings domain), but only with a placeholder, so that we can define the UI, dashboard item and settings for each one later: see the microfrontend-architecture intake."

**Origin**: This spec builds on [020-domain-library-architecture](../020-domain-library-architecture/spec.md) (the domain-library structure, boundary enforcement, and per-account domain-entitlement mechanism, proven on Holdings) and [021-frontend-extension-points](../021-frontend-extension-points/spec.md) (the Dashboard/Settings per-domain extension mechanism). Per [.specify/assessments/microfrontend-architecture/intake.md](../../.specify/assessments/microfrontend-architecture/intake.md), Vaultfolio is pivoting from a single investment-tracking app to a multi-domain personal finance app; this spec adds the five remaining domains — Retirement, Insurances, Haushaltsplaner (household/budget planner), Historic Wealth Development, and Account Overview — as registered, navigable, entitlement-gated placeholders, so each one's real UI, dashboard contribution, and settings can be designed and built independently later without first having to wire up the domain itself.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - A new domain is visible, reachable, and gated like Holdings (Priority: P1)

An entitled user needs to see each of the five new domains as its own entry in the app's navigation, alongside Holdings, and be able to open it to a simple placeholder page confirming the domain exists — without any of the domain's real functionality having been built yet.

**Why this priority**: This is the entire point of the feature — it proves each new domain is properly registered in the existing domain/entitlement mechanism (per 020) before any real feature work starts on it. Without this, later work on any one domain would have to first solve the same wiring problem individually.

**Independent Test**: Can be fully tested by granting a test user entitlement to one new domain, confirming its navigation entry and placeholder page appear and open correctly, and confirming the other four new domains and Holdings are unaffected.

**Acceptance Scenarios**:

1. **Given** a user entitled to a new domain, **When** they view the app navigation, **Then** that domain's entry appears alongside Holdings and any other domains they are entitled to.
2. **Given** a user entitled to a new domain, **When** they open that domain's navigation entry, **Then** a placeholder page loads that clearly identifies the domain (e.g., by name) and indicates it is not yet built out.
3. **Given** a user not entitled to a new domain, **When** they view the app navigation, **Then** that domain's entry does not appear.
4. **Given** a user not entitled to a new domain, **When** they navigate directly to that domain's URL, **Then** they are denied access the same way an unentitled user is denied any other domain's route today.
5. **Given** all five new domains have been added, **When** an existing Holdings user without any new entitlement signs in, **Then** their Holdings navigation, routes, and functionality are unchanged from before this feature.

---

### User Story 2 - Dashboard and Settings stay intact with domains that contribute nothing yet (Priority: P2)

Since each new domain is placeholder-only, none of them contribute a Dashboard widget or a Settings tab yet. An entitled user's Dashboard and Settings screens need to keep working normally — showing only what Holdings and any other already-built domain contribute — without gaps, errors, or placeholder clutter from the five new domains.

**Why this priority**: This confirms the extension-point mechanism from 021 behaves correctly for the common "domain contributes nothing (yet)" case, which is now the majority case (five of six domains). It depends on User Story 1 existing (domains must be registered first).

**Independent Test**: Can be fully tested by entitling a test user to one or more of the five new domains and confirming their Dashboard and Settings screens render exactly as they would with only Holdings entitlement, with no errors, empty widget slots, or empty tabs attributable to the new domains.

**Acceptance Scenarios**:

1. **Given** a user entitled to one or more of the five new domains, **When** they view the Dashboard, **Then** no widget, error, or empty gap appears for any of those domains.
2. **Given** a user entitled to one or more of the five new domains, **When** they open Settings, **Then** no extra tab, error, or empty tab appears for any of those domains.

---

### User Story 3 - Administrators can grant access to each new domain individually (Priority: P3)

An administrator needs to grant or revoke a specific user's access to each of the five new domains one at a time, the same way Holdings access is managed today, so the team can pilot a domain with specific users before it has real functionality.

**Why this priority**: Lower priority than Stories 1-2 because the underlying entitlement-management mechanism already exists (per 020); this only confirms it extends cleanly to five more domain ids without additional engineering per domain.

**Independent Test**: Can be fully tested by having an administrator grant one new domain to a test user, confirming that user gains exactly that domain's navigation entry and access, then revoking it and confirming access is removed, with no effect on the user's other entitlements.

**Acceptance Scenarios**:

1. **Given** an administrator viewing a user's account, **When** they grant that user one of the five new domains, **Then** the user gains that domain's navigation entry and route access without any other change to their access.
2. **Given** an administrator viewing a user's account, **When** they revoke a previously granted new domain, **Then** the user loses that domain's navigation entry and route access without any other change to their access.
3. **Given** an administrator account, **When** an administrator signs in, **Then** all five new domains are visible and reachable by default, consistent with how administrators already access every existing domain.

### Edge Cases

- What happens when a user is entitled to a new domain but to none of the domains that currently contribute Dashboard widgets or Settings tabs? The Dashboard and Settings screens still render their non-domain-specific content without error.
- What happens when a user is entitled to all six domains (Holdings plus all five new ones)? All six navigation entries appear, in a stable, predictable order, and each opens its own page (Holdings' real feature, the other five placeholders) without interference between them.
- What happens when a user is entitled to none of the five new domains? The application behaves exactly as it does today, with only Holdings (and any other already-entitled domain) visible.
- What happens if two of the new domains are given very similar names? Each placeholder page and navigation entry unambiguously identifies which of the five domains it is.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST register five new domains, distinct from Holdings and from each other: Retirement, Insurances, Haushaltsplaner (household/budget planner), Historic Wealth Development, and Account Overview.
- **FR-002**: Each new domain MUST have its own navigation entry, shown only to users entitled to that specific domain, using the same entitlement mechanism that already governs Holdings' visibility.
- **FR-003**: Each new domain MUST expose exactly one placeholder page that identifies the domain by name and clearly communicates that its functionality is not yet available.
- **FR-004**: Each new domain's route(s) MUST be denied to users not entitled to that domain, consistent with how an unentitled user is denied Holdings' routes today.
- **FR-005**: None of the five new domains MUST contribute a Dashboard widget or a Settings tab at this time; their absence from Dashboard and Settings MUST NOT produce errors, empty gaps, or empty tabs.
- **FR-006**: Adding the five new domains MUST NOT change or regress any existing Holdings navigation, routing, Dashboard, Settings, or feature behavior.
- **FR-007**: Each new domain MUST be structured through the same domain-registration mechanism used for Holdings, so that adding its real routes, Dashboard widget, and/or Settings tab later requires only additive changes within that domain, not changes to the app-shell, Dashboard, Settings, or another domain.
- **FR-008**: Administrators MUST be able to grant and revoke any individual user's entitlement to any of the five new domains independently of that user's entitlement to any other domain, using the same mechanism already used to manage Holdings entitlement.
- **FR-009**: Administrator accounts MUST have access to all five new domains by default, consistent with administrators' existing default access to Holdings.
- **FR-010**: Existing user accounts' entitlements MUST be unaffected by this change — no existing account gains automatic access to any of the five new domains as a side effect of the domains being registered.

### Key Entities

- **Domain**: A registered, independently addressable area of the application (e.g., Retirement, Insurances). Has a stable identifier, a display name, and a navigable placeholder page for the five new ones; Holdings is the existing domain with real functionality.
- **Domain Entitlement**: The association between a user account and the set of domains that account may see and access; already exists for Holdings and extends to cover the five new domain identifiers.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: All five new domains are visible in the app navigation and reachable via a placeholder page for a user entitled to them, with zero code changes required to the Dashboard, Settings, or any other domain's code beyond registering the new domain itself.
- **SC-002**: A user with no entitlement to a given new domain can never see its navigation entry or reach its page directly, verified for all five new domains.
- **SC-003**: An administrator can grant or revoke a specific user's access to any one of the five new domains, independent of the user's other entitlements, without engineering involvement.
- **SC-004**: 100% of existing Holdings user journeys (navigation, routing, Dashboard, Settings) behave identically before and after this feature is deployed.
- **SC-005**: A user entitled to any combination of the five new domains sees a Dashboard and Settings experience with no errors, blank widget slots, or blank tabs attributable to those domains.

## Assumptions

- The existing per-account domain-entitlement mechanism and domain-registration pattern established for Holdings (020) and the Dashboard/Settings extension points (021) are reused as-is; no new entitlement model, gating rule, or extension mechanism is introduced by this feature.
- A placeholder page needs no domain-specific data, business logic, or design polish beyond naming the domain and indicating it is not yet built — visual design of each domain's placeholder is not a goal of this feature.
- The five domain names and short descriptions are taken directly from the intake document (Retirement, Insurances, Haushaltsplaner, Historic Wealth Development, Account Overview); exact user-facing copy, ordering, and iconography may be refined without re-scoping this feature.
- No dashboard widget or settings tab is added for any of the five new domains as part of this feature; those are explicitly deferred to when each domain's real UI is designed, per the intake's framing.
- Billing/subscription-based gating (raised as a future possibility in the intake) is out of scope; only the existing role/entitlement-based gating applies.
