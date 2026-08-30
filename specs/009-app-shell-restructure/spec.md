# Feature Specification: App Shell Restructure

**Feature Branch**: `009-app-shell-restructure`

**Created**: 2026-08-30

**Status**: Draft

**Design**: [design.md](./design.md) — approved shell mockup for the signed-out and signed-in states.

**Input**: User description: "I would like to update the application shell in the following way:

- the header must always be visible, both for unauthenticated pages and for authenticated pages
- the authenticated pages must be under the <baseUrl>/app
- the unauthenticated pages must be directly under the <baseUrl>, e.g. <baseUrl>/<unauthenticated-page>
- after successful sign-in, the side-navigation is visible for authenticated users
- the navigation header bar for authenticated users to show thair name, the role badge and the sign-out button
- the side-navigation must show up only for authenticated users"

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Consistent header across the whole application (Priority: P1)

A visitor opens Vaultfolio, whether or not they are signed in. Regardless of which page they land on — a public page like sign-in, or an authenticated page like the dashboard — the same application header is present at the top of the screen, giving the product a consistent identity and a stable place to sign in, see who is signed in, or sign out.

**Why this priority**: The header is the one shell element the request requires everywhere; without it, unauthenticated pages currently render with no shell at all, which is the core inconsistency this feature fixes. It has no dependency on the other stories and delivers value on its own.

**Independent Test**: Can be fully tested by visiting a public page (e.g. sign-in) and an authenticated page (e.g. dashboard) and confirming the same header component is present and rendered in both, with content appropriate to the visitor's authentication state.

**Acceptance Scenarios**:

1. **Given** a visitor is not signed in, **When** they navigate to a public page such as sign-in, **Then** the application header is visible at the top of the page.
2. **Given** a visitor is signed in, **When** they navigate to any authenticated page, **Then** the application header is visible at the top of the page.
3. **Given** a visitor is not signed in, **When** they view the header, **Then** it does not display any signed-in user's name, role badge, or sign-out control.

---

### User Story 2 - Authenticated pages relocated under /app (Priority: P1)

An authenticated user's pages (dashboard, holdings, imports, settings, and any future authenticated pages) are addressed under a distinct `/app` section of the site, separate from the public, unauthenticated pages that live directly under the site's base URL. This gives the application a clear, predictable split between "public site" and "signed-in product" areas.

**Why this priority**: This is a structural routing change that the side-navigation visibility and header behavior depend on being in place; it defines the boundary the rest of the feature relies on.

**Independent Test**: Can be fully tested by signing in and confirming every authenticated page is reachable at a `/app/...` address, and confirming a public page is reachable directly at the base URL with no `/app` prefix.

**Acceptance Scenarios**:

1. **Given** a signed-in user, **When** they navigate to the dashboard, **Then** the address is `/app/dashboard` (and correspondingly for holdings, imports, and settings).
2. **Given** any user, **When** they navigate to a public page such as sign-in or sign-up, **Then** the address is directly under the base URL (e.g. `/sign-in`, `/signup`) with no `/app` prefix.
3. **Given** a signed-in user who previously bookmarked or was linked to an old, non-`/app` authenticated page address, **When** they open that link, **Then** they land on the equivalent working page rather than an error.
4. **Given** an unauthenticated visitor, **When** they request any `/app/...` address, **Then** they are redirected to sign-in instead of seeing the authenticated page.

---

### User Story 3 - Side-navigation appears only for signed-in users (Priority: P1)

Once a user successfully signs in, a side-navigation menu becomes visible, letting them move between the authenticated areas of the product (dashboard, holdings, imports, settings). Before signing in, or after signing out, no side-navigation is shown — public pages use only the header.

**Why this priority**: This is the second half of the requested shell behavior and is what makes the `/app` vs. public split visible and usable to the end user; it is equally critical to the header change but is listed after it only because it depends on knowing which pages are authenticated (User Story 2).

**Independent Test**: Can be fully tested by loading a public page and confirming no side-navigation is present, then signing in and confirming the side-navigation appears and lists the authenticated areas, then signing out and confirming it disappears again.

**Acceptance Scenarios**:

1. **Given** a visitor is not signed in, **When** they view any public page, **Then** no side-navigation is present.
2. **Given** a user completes sign-in successfully, **When** the authenticated page loads, **Then** the side-navigation is visible and lists the authenticated areas (dashboard, holdings, imports, settings).
3. **Given** a signed-in user, **When** they sign out, **Then** the side-navigation is no longer visible on the page they land on afterward.

---

### User Story 4 - Header shows the signed-in user's identity and sign-out control (Priority: P2)

While signed in, the header displays the current user's name, their role badge, and a control to sign out, so the user always has visible confirmation of who they're signed in as and a one-step way to end their session, no matter which authenticated page they're on.

**Why this priority**: This refines the header's authenticated-state content; it builds on User Story 1 (header always present) and is a smaller, more specific piece of the overall header behavior, so it can follow the higher-priority stories.

**Independent Test**: Can be fully tested by signing in and confirming the header shows the user's display name, a role badge, and a sign-out control that successfully ends the session when activated.

**Acceptance Scenarios**:

1. **Given** a signed-in user, **When** they view the header on any authenticated page, **Then** it displays their name and a role badge reflecting their assigned role.
2. **Given** a signed-in user, **When** they select the sign-out control in the header, **Then** their session ends and they are returned to a public page with no signed-in header content or side-navigation.

---

### Edge Cases

- A signed-in user's session expires or becomes invalid while they are on an `/app/...` page: they are treated as unauthenticated and redirected to sign-in.
- A user navigates directly to a not-found address: the header remains visible, and the side-navigation is shown only if the user is signed in at the time.
- A user signs in from a public page other than sign-in (e.g. via a redirect after visiting a protected link): after success they land on the intended authenticated `/app` page with header and side-navigation both present.
- The header's identity content (name, role badge, sign-out) must not appear for an instant on a public page during sign-out or before authentication state is known.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The system MUST render the application header on every page, whether the visitor is authenticated or not.
- **FR-002**: The system MUST place all authenticated pages (currently: dashboard, holdings, imports, settings, and any pages added to the authenticated area in the future) under the `/app` path segment.
- **FR-003**: The system MUST place all unauthenticated (public) pages directly under the site's base URL, with no `/app` prefix.
- **FR-004**: The system MUST show the side-navigation only when the current visitor is signed in.
- **FR-005**: The system MUST show the side-navigation immediately after a successful sign-in, without requiring a manual page refresh.
- **FR-006**: The system MUST hide the side-navigation on all public (unauthenticated) pages.
- **FR-007**: The system MUST hide the side-navigation immediately after sign-out.
- **FR-008**: The header MUST display, for a signed-in user, their display name, their role badge, and a sign-out control.
- **FR-009**: The header MUST NOT display a user's name, role badge, or sign-out control when no one is signed in.
- **FR-010**: Activating the sign-out control MUST end the current session and return the user to a public page.
- **FR-011**: The system MUST redirect an unauthenticated visitor who requests any `/app/...` address to the sign-in page.
- **FR-012**: The system MUST continue to prevent an authenticated page from being reachable without a valid session, consistent with existing access-control behavior.
- **FR-013**: Existing links or bookmarks to authenticated pages at their prior (non-`/app`) addresses MUST continue to reach the equivalent working page.

### Key Entities

- **Application Shell**: The persistent chrome wrapping every page — the header (always present) and the side-navigation (present only for authenticated visitors) — surrounding the page-specific content.
- **Public Area**: The set of pages reachable directly under the base URL that do not require a signed-in session (e.g. sign-in, sign-up, invite acceptance, password reset).
- **Authenticated Area**: The set of pages reachable under `/app` that require a signed-in session (e.g. dashboard, holdings, imports, settings).

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: 100% of pages, public and authenticated, render the application header.
- **SC-002**: 100% of authenticated pages are reachable only under `/app` addresses, and 0% of public pages carry the `/app` prefix.
- **SC-003**: The side-navigation is visible on 100% of authenticated pages and absent from 100% of public pages.
- **SC-004**: A user can identify who is signed in (name and role) and sign out from any authenticated page without navigating elsewhere, in one action.
- **SC-005**: After signing in, the side-navigation appears without any additional user action beyond completing sign-in.
- **SC-006**: After signing out, no authenticated-only shell element (side-navigation, user name, role badge, sign-out control) remains visible.

## Assumptions

- "Authenticated pages" refers to the existing set of pages that currently require a signed-in session (dashboard, holdings, imports, settings) plus any pages added to that set going forward; the set of which pages require authentication is unchanged by this feature.
- "Unauthenticated pages" refers to the existing public pages (sign-in, sign-up and its verification step, invite acceptance/expired, and the account email-verification/forgot-password/reset-password pages), which continue to require no session and remain directly under the base URL.
- The role badge continues to reflect whichever role model already exists in the product; this feature does not change how roles are assigned or labeled, only where and when the badge is shown.
- Prior addresses for now-relocated authenticated pages are treated as legacy addresses that should keep working (redirect or equivalent), so existing bookmarks and links are not broken.
- No visual redesign of the header or side-navigation content itself is in scope beyond what's needed to show/hide them correctly and display the specified identity information; this feature is about visibility, placement, and structure, not new styling.
