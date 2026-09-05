# Feature Specification: Domain Library Architecture

**Feature Branch**: `020-domain-library-architecture`

**Created**: 2026-09-05

**Status**: Draft

**Input**: User description: "microfrontend-architecture"

**Origin**: This spec builds on the `go` decision recorded at [.specify/assessments/microfrontend-architecture/decision.md](.specify/assessments/microfrontend-architecture/decision.md) (Option B — Nx domain libraries with enforced boundaries + scoped entitlements). See that decision and its `problem.md`, `research.md`, and `concept.md` for the full alternatives analysis and rejected options (status-quo route modules; Module Federation).

## User Scenarios & Testing _(mandatory)_

<!--
  IMPORTANT: User stories should be PRIORITIZED as user journeys ordered by importance.
  Each user story/journey must be INDEPENDENTLY TESTABLE - meaning if you implement just ONE of them,
  you should still have a viable MVP (Minimum Viable Product) that delivers value.
-->

### User Story 1 - Boundary between domains is enforced, not just assumed (Priority: P1)

The Vaultfolio team is about to grow the product from one domain (holdings) to several (retirement, insurances, household planning, historic wealth development, account overview). Today nothing stops a new domain's code from directly importing another domain's internals — coupling is prevented only by discipline. The team needs the codebase itself to reject such an import, so that as domain after domain is added, none of them can silently tangle with the others.

**Why this priority**: This is the core problem the decision identified: without enforcement, the architecture degrades exactly the way the current single app would if domains were simply added as more routes. Everything else (retrofitting holdings, centralizing access control) only matters if this boundary actually holds.

**Independent Test**: Can be fully tested by adding a domain library and attempting, from a different domain's code, to import a file from it directly (bypassing its public entry point) — the build/lint step must fail. Delivers value on its own: it protects the codebase's structure even before any second domain exists.

**Acceptance Scenarios**:

1. **Given** two separate domain libraries exist in the workspace, **When** code in one domain library imports an internal (non-public-API) file from another domain library, **Then** the lint/build step fails with an error identifying the boundary violation.
2. **Given** a domain library's own internal files, **When** other files within that same domain library import each other, **Then** the build succeeds (the boundary blocks cross-domain imports only, not intra-domain ones).
3. **Given** the app-shell (routing/navigation composition root), **When** it imports a domain's published feature entry point to wire up a route, **Then** the build succeeds (the shell may route to a domain without violating its boundary).

---

### User Story 2 - Holdings becomes the first domain, without breaking today's functionality (Priority: P1)

Today's entire application is "holdings" — investment tracking, holdings entry, imports, and the distribution chart (specs 003–004, 016–019). This user story moves that existing functionality into the new domain-library structure so it becomes the proof that the pattern works, before any of the five new domains are built.

**Why this priority**: Retrofitting holdings is what turns the boundary enforcement from User Story 1 into something real rather than an empty shell with no domains in it. It's also the highest-risk step (existing, in-production functionality must not regress), so it needs to be validated early.

**Independent Test**: Can be fully tested by exercising every existing holdings user flow (create/edit/delete a holding, import, view the distribution-by-type chart) after the retrofit and confirming behavior is unchanged from before — with the holdings code now living inside the new domain-library structure and its access route going through the shared entitlements mechanism from User Story 3.

**Acceptance Scenarios**:

1. **Given** a user who could access holdings before this change, **When** they log in after the change, **Then** they can still view, create, edit, delete, and import holdings exactly as before.
2. **Given** the holdings domain has been retrofitted, **When** a developer inspects the workspace's project structure, **Then** holdings' feature code (components, routes, data access) lives inside the new domain-library grouping rather than scattered inline under the generic application shell.
3. **Given** the retrofit is complete, **When** the boundary-enforcement check from User Story 1 runs against the holdings domain library, **Then** it passes (holdings itself does not violate the boundary it now sits behind).

---

### User Story 3 - Who can see a domain is decided in one place (Priority: P2)

Today, whether a user sees a feature is governed by a single binary Administrator/member check on the side-nav. As domains are added, the team needs a single mechanism that decides "can this user access domain X" — used identically to filter the navigation and to guard the route — so a user can never end up with a route reachable but hidden from navigation, or vice versa.

**Why this priority**: This directly serves the decision's second goal (centralized, extensible access control) and is what makes adding a new domain later a configuration change rather than a code change scattered through the app. It depends on User Stories 1–2 existing first (a domain to gate).

**Independent Test**: Can be fully tested by changing a test user's domain access and confirming both the navigation entry and the route guard's behavior change together, for the holdings domain, without touching any UI-rendering or routing code beyond registering the check.

**Acceptance Scenarios**:

1. **Given** a user who is not entitled to a domain, **When** they view the app navigation, **Then** that domain's entry does not appear.
2. **Given** a user who is not entitled to a domain, **When** they navigate directly to that domain's route (e.g., by URL), **Then** they are denied access the same way an unauthenticated user is denied access to `/app` today.
3. **Given** a user who is entitled to a domain, **When** they view the navigation and navigate to that domain's route, **Then** both the navigation entry and the route are available.
4. **Given** an Administrator, **When** their domain entitlements are evaluated, **Then** they retain access to every existing domain (holdings) by default, consistent with their current administrative access.

---

### Edge Cases

- What happens when a domain exists in the codebase but no user has been granted access to it yet (e.g., a future domain scaffolded ahead of its own feature work)? The domain's navigation entry MUST stay hidden and its route MUST stay blocked for everyone except Administrators, rather than erroring.
- What happens when a user's domain entitlements change while they have an active session? The change MUST take effect on their next navigation/route evaluation (session refresh or re-login), not require immediate server-push invalidation.
- What happens when the app-shell itself is built or modified — does it accidentally gain a dependency on a domain's internals? The same boundary check from User Story 1 MUST apply to the shell (it may depend on a domain's published entry point and the shared entitlements mechanism, never on a domain's internals).
- What happens when two domains need to share genuinely common code (e.g., a formatting helper)? It MUST live in a shared, non-domain-tagged library that both are allowed to depend on, rather than one domain depending on another.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The system MUST organize each product domain's frontend feature code (starting with holdings) as its own dedicated library grouping, structurally separate from the app-shell (navigation, layout, routing composition) and from other domains.
- **FR-002**: The system MUST automatically enforce, as part of the existing build/lint pipeline, that one domain's library code cannot import another domain's internal (non-public) code.
- **FR-003**: The boundary-enforcement check MUST run in the same continuous-integration step that already enforces the workspace's existing `scope:*` boundary convention, so a violation blocks a merge the same way an existing boundary violation does today.
- **FR-004**: The system MUST provide one shared mechanism that determines whether a given user is entitled to access a given domain, used by both route guards and navigation rendering.
- **FR-005**: The holdings domain's route(s) MUST be protected by this shared entitlements mechanism instead of (or in addition to) today's binary Administrator/member check.
- **FR-006**: The app's navigation MUST render a domain's entry only when the current user is entitled to that domain, using the same shared entitlements mechanism as the route guard.
- **FR-007**: The system MUST extend the existing user/session role model to record which domain(s) a user is entitled to access, without altering today's existing Administrator/member distinction.
- **FR-008**: Administrators MUST retain access to all existing domains by default after this change, matching their current level of access.
- **FR-009**: All existing holdings functionality (entry, editing, deletion, import, and the holdings distribution chart) MUST continue to work unchanged for users who had access before this change.
- **FR-010**: The system MUST remain a single deployable application; this restructuring MUST NOT introduce independently built or independently deployed bundles per domain.
- **FR-011**: The chosen structure MUST allow a future new domain to be added by creating a new domain library, boundary tag, and entitlement scope, without requiring changes to holdings' code, tests, or deploy path.

### Key Entities

- **Domain**: A bounded product area of Vaultfolio (e.g., holdings; and, in future specs, retirement, insurances, household planning, historic wealth development, account overview). Represented in the codebase as a distinct library grouping with an associated boundary tag; represented to a user as a distinct area of the navigation and routing.
- **Domain Entitlement (Scope)**: The association between a user and the set of domains they are permitted to access. Extends the existing user/session record; does not replace the existing Administrator/member role.
- **Shell**: The existing app-shell (navigation, layout, authentication/session bootstrap, and route composition) that hosts domains but does not itself contain domain-specific logic.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: An attempted cross-domain internal import is caught and blocks the build 100% of the time it is introduced, without relying on code review to catch it.
- **SC-002**: Every existing holdings user flow (create, edit, delete, import, view distribution chart) passes its existing acceptance criteria unchanged after the retrofit — zero functional regressions.
- **SC-003**: Determining whether a user can access a given domain requires consulting exactly one shared mechanism — no domain-specific access conditionals exist outside it.
- **SC-004**: A team member can describe, without reading domain-internal code, what would be required to add a next domain (one library grouping, one boundary tag, one entitlement scope) — confirming the structure generalizes beyond holdings.
- **SC-005**: The application continues to build and deploy as a single artifact via the existing deployment pipeline, with no new deployment steps introduced by this change.

## Assumptions

- The existing binary Administrator/member role (spec 005) is extended with a domain-scopes field rather than being redesigned; Administrators are assumed to retain all-domain access by default so this change does not narrow any existing user's access on its own.
- The workspace's existing Nx module-boundary tooling (`@nx/enforce-module-boundaries`, already governing the `scope:*` tag convention per CLAUDE.md) is capable of expressing the new domain-boundary constraints; validating the exact `depConstraints` configuration is implementation work for the planning phase, not a scope decision for this spec.
- This spec covers the domain-library structure, its enforcement, and the entitlements mechanism, applied to holdings as the first (and currently only) domain. Building the five additional planned domains (retirement, insurances, household planning, historic wealth development, account overview) — including deciding their order or whether they ship incrementally — is out of scope and left to future specs, per the decision's handoff.
- Cross-domain data aggregation (e.g., a combined net-worth view spanning holdings, banking, and insurance data) is out of scope for this spec, per the decision's non-goals; it is a separate data-architecture problem to be addressed when the first domain that needs it is specified.
- No billing/subscription-based gating is designed here; the entitlements mechanism is scope-based only, consistent with the decision's non-goals.
- Independent per-domain deploy cadences and independently deployed bundles (the Module Federation approach originally proposed) remain explicitly out of scope; the single team, single build/deploy artifact model continues.
