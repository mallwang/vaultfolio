# Phase 0 Research: Restructure Admin & Settings Navigation

No open `NEEDS CLARIFICATION` markers remain in the Technical Context — this feature is a
frontend-only reorganization of existing, already-implemented functionality, so the research
below documents the decisions confirmed by exploring the current codebase rather than resolving
unknowns about a new technology.

## Decision: Role-based nav visibility via a filtered list, not a structural nav rewrite

- **Decision**: Add an optional `roles?: UserRole[]` field to the existing `ApplicationArea`
  interface in `application-areas.ts`, and filter `APPLICATION_AREAS` by the current user's role
  (from `CurrentUserStore`) inside `AppSidebarComponent` before rendering. An area with no `roles`
  field is visible to everyone (Dashboard, Holdings, Imports, Settings); the new Admin area
  declares `roles: ['ADMIN']`.
- **Rationale**: `application-areas.ts` is already the single source of truth the sidebar iterates
  over (`@for` over `APPLICATION_AREAS`). Extending its shape is the smallest change that satisfies
  FR-005/FR-006 and keeps the sidebar template a pure render of that list, consistent with the
  existing pattern rather than introducing a parallel nav-config mechanism.
- **Alternatives considered**:
  - A dedicated `NavService` with role-aware logic — rejected as unnecessary indirection (YAGNI,
    Principle V) for a single boolean-visibility rule with one consumer (the sidebar).
  - Hard-coding an `*ngIf` role check per nav item in the sidebar template — rejected because it
    scatters the role predicate across the template instead of the existing declarative data
    model, making future role-gated areas harder to add consistently.

## Decision: Route-level guard (`adminGuard`) modeled on `authGuard`

- **Decision**: New functional `CanActivateFn` `adminGuard` in `apps/frontend/src/app/auth/`,
  checking `currentUserStore.current()?.role === 'ADMIN'`; on failure, redirect to
  `/app/dashboard` (the same "just land somewhere safe" behavior implied by the spec's Edge Cases
  section, which asks only that admin content not be shown — not that a dedicated
  access-denied page be built).
- **Rationale**: `auth.guard.ts` already establishes the functional-guard-with-`inject()` pattern
  used on the `app` parent route; mirroring it keeps guard style consistent and requires no new
  guard architecture. This guard is a UX/defense-in-depth measure — the actual security boundary
  remains the backend's `RolesGuard`/`@Roles('ADMIN')` (Constitution Principle II: API is the only
  path to data), which already rejects MEMBER requests to admin endpoints regardless of what the
  frontend renders or guards.
- **Alternatives considered**:
  - Reusing `authGuard` with an inline role check duplicated at the route definition — rejected;
    a named `adminGuard` documents intent at the route table and is independently unit-testable.
  - Building a dedicated "access denied" page/component — rejected per spec Assumptions: MEMBER
    users should be handled "the same way the system already handles unauthorized access to other
    protected content," i.e. redirect, not a new UI surface (YAGNI, Principle V).

## Decision: Admin tab container mirrors Settings' existing PrimeNG tabs pattern

- **Decision**: `admin.component.ts`/`.html` reuses the same `p-tabs`/`p-tablist`/`p-tabpanels`
  in-component tab-switching approach `settings.component.ts` already uses (not Angular child
  routes per tab), with tabs Accounts, Sign-ups, Invitations, General.
- **Rationale**: Settings' tabs are not currently deep-linkable sub-routes; keeping Admin
  consistent avoids introducing a second navigation paradigm (child routes) alongside the first
  (in-component tabs) for what is otherwise the same kind of grouping UI. Existing tab components
  (`AccountsComponent`, `SignupsComponent`, `InvitationsComponent`, `HealthStatusComponent`) are
  moved with no internal changes, preserving FR-002/FR-008/SC-004.
- **Alternatives considered**:
  - Angular child routes per admin section (`/app/admin/accounts`, etc.) — would allow deep
    linking per tab, but is a larger structural change than the spec requires and diverges from
    the sibling Settings area's established pattern; not pursued (YAGNI). Can be revisited later
    if deep-linking into a specific admin tab becomes a real requirement.

## Decision: Preferences promoted to a small standalone component

- **Decision**: Extract the inline "Coming soon" `p-card` currently embedded in
  `settings.component.html`'s General tab into its own `preferences.component.ts`/`.html`, added
  as a new Settings tab alongside Profile.
- **Rationale**: FR-003/FR-004 require Preferences to be its own Settings section, and the spec's
  Assumptions state it must keep identical placeholder content. A tiny standalone component (vs.
  leaving it inline in `settings.component.html`) matches how Profile is already structured as its
  own component/tab, keeping the two Settings tabs symmetric and making the "will be extended
  soon" placeholder a natural home for future preferences functionality.
- **Alternatives considered**: Leaving the placeholder markup inline in `settings.component.html`
  under a new tab — works but breaks the pattern where each Settings tab is backed by its own
  component (as Profile already is), and would make future extension of Preferences (explicitly
  anticipated by the spec) require restructuring later anyway.
