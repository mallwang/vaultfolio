# Feature Specification: Vaultfolio Branding

**Feature Branch**: `011-vaultfolio-branding`

**Created**: 2026-08-30

**Status**: Draft

**Input**: User description: "Vaultfolio branding: apply the Vaultfolio logo and identity across the frontend shell. Replace the generic "frontend" browser tab title with "Vaultfolio - <Page>" per-route titles (via a custom Angular TitleStrategy), add the Vaultfolio logo to the app header (replacing the old sidebar brand mark/wordmark, which is removed since the header now carries the brand), use it as the favicon and apple-touch-icon, and swap the PrimeNG Aura theme's primary palette from the default emerald to a teal preset (pinned to teal.700, matching the logo's icon color) for buttons/links/focus rings. Also add the logo to the project README."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Recognizable browser tab per page (Priority: P1)

As a user with several browser tabs open (or switching between the sign-in page and the app), I want each tab to clearly show "Vaultfolio" plus the page I'm on, so I can find the right tab at a glance instead of seeing an unbranded, identical "frontend" title everywhere.

**Why this priority**: This is the most visible, most frequently encountered branding gap — every single page load and navigation currently shows a generic, non-product title. It affects every user, every session.

**Independent Test**: Load any route in the app (sign-in, dashboard, holdings, settings, a 404) and confirm the browser tab reads "Vaultfolio - <Page Name>", with a bare "Vaultfolio" fallback for any route without a specific page name.

**Acceptance Scenarios**:

1. **Given** a user navigates to the sign-in page, **When** the page loads, **Then** the browser tab title reads "Vaultfolio - Sign In".
2. **Given** a signed-in user navigates between Dashboard, Holdings, Imports, and Settings, **When** each page loads, **Then** the browser tab title updates to "Vaultfolio - Dashboard", "Vaultfolio - Holdings", "Vaultfolio - Imports", "Vaultfolio - Settings" respectively.
3. **Given** a user hits an unknown route, **When** the not-found page loads, **Then** the browser tab title reads "Vaultfolio - Not Found".

---

### User Story 2 - Consistent brand identity in the app shell (Priority: P2)

As a user, I want to see the Vaultfolio logo and mark represented consistently in the app (browser tab icon, header) so the product feels cohesive and trustworthy rather than looking like an unfinished template.

**Why this priority**: Visual identity reinforces trust and polish but is less functionally disruptive than the tab-title issue — users can still use the app perfectly well without it, it's a quality/perception improvement.

**Independent Test**: Open the app and inspect the browser tab icon (favicon) and the app header; confirm the Vaultfolio logo appears in both, and that the old placeholder brand mark in the sidebar is gone (not duplicated).

**Acceptance Scenarios**:

1. **Given** a user opens the app in a browser, **When** the page loads, **Then** the browser tab icon shows the Vaultfolio logo (not the previous generic icon).
2. **Given** a user adds the app to their home screen on a touch device, **When** the home-screen icon is generated, **Then** it uses the Vaultfolio logo.
3. **Given** a signed-in user views any page, **When** they look at the app header, **Then** they see the Vaultfolio logo alongside the "Vaultfolio" wordmark and current page title.
4. **Given** a signed-in user views the app on a narrow/mobile viewport where the sidebar collapses to a bottom nav, **When** they look at the sidebar area, **Then** no separate brand mark/wordmark is shown there (branding lives only in the header).

---

### User Story 3 - Brand-consistent accent color (Priority: P3)

As a user, I want the interactive accent color used for buttons, links, and focus indicators throughout the app to match the Vaultfolio logo's color, so the product's visual language feels unified rather than using an unrelated default color.

**Why this priority**: A color-scheme mismatch is the least disruptive of the three gaps — the app is fully usable and internally consistent today with the default color, this is a refinement that ties the UI to the logo.

**Independent Test**: Open the app and inspect a primary button, a link, and a focused form field; confirm the accent color used matches the Vaultfolio logo's icon color rather than the previous default green.

**Acceptance Scenarios**:

1. **Given** any page with a primary-styled button (e.g. "Sign In", "Save"), **When** the user views it, **Then** its color matches the Vaultfolio logo's accent color.
2. **Given** any page with a focusable form field, **When** the user tabs into it, **Then** the focus ring uses the same brand accent color.
3. **Given** a user hovers or activates a primary control, **When** the interaction state changes, **Then** the hover/active shades are visibly darker variants of the same brand color family, not a different hue.

---

### User Story 4 - Branded project README (Priority: P4)

As a developer or visitor landing on the project's repository, I want the README to visually identify the project as Vaultfolio, so the repository reads as a real, named product rather than an anonymous codebase.

**Why this priority**: Lowest priority — it affects only repository visitors (contributors, reviewers), not end users of the running application.

**Independent Test**: Open the README file and confirm the Vaultfolio logo is displayed near the top, before the project description.

**Acceptance Scenarios**:

1. **Given** a visitor opens the project README, **When** it renders, **Then** the Vaultfolio logo is displayed centered above the introductory description.

---

### Edge Cases

- A route with no configured page title (if one is ever added without a `title`) MUST still show a sensible tab title ("Vaultfolio" alone) rather than a blank or stale title.
- The logo image failing to load (e.g. offline, broken cache) MUST NOT break the header layout or leave broken-image icons that obscure the page title — the header's textual content stays legible either way.
- Existing bookmarks/pinned tabs relying on the old favicon should still resolve (same file path/icon route), just with new artwork.
- The accent color change must be applied consistently across both light and dark theme modes, not just one.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The system MUST set the browser tab title for every route to "Vaultfolio - <Page Name>", where `<Page Name>` is a short, human-readable label for that route (e.g. "Dashboard", "Sign In", "Settings").
- **FR-002**: The system MUST fall back to the bare title "Vaultfolio" for any route that has no page-name label configured.
- **FR-003**: The system MUST update the tab title automatically on every client-side navigation, without requiring a full page reload.
- **FR-004**: The system MUST display the Vaultfolio logo as the browser tab icon (favicon).
- **FR-005**: The system MUST display the Vaultfolio logo as the icon used when the app is added to a mobile/touch device home screen.
- **FR-006**: The system MUST display the Vaultfolio logo in the app header, alongside the existing "Vaultfolio" wordmark and current page/section title.
- **FR-007**: The system MUST remove the previous standalone brand mark and wordmark from the sidebar navigation (including its collapsed/mobile layout), so the brand is represented once, in the header, rather than duplicated.
- **FR-008**: The system MUST apply a brand-consistent accent color, derived from the Vaultfolio logo's icon color, to primary interactive elements (buttons, links, focus indicators) in both light and dark modes.
- **FR-009**: The accent color MUST provide the standard range of shades (base, hover, active, and a light-to-dark scale) needed by existing UI components, not just a single fixed value.
- **FR-010**: The project README MUST display the Vaultfolio logo near the top of the document, above the introductory project description.

### Key Entities

- **Route Page Title**: A short, human-readable label associated with a navigable route (e.g. "Dashboard", "Holdings", "Sign In"), used to compose the browser tab title.
- **Brand Asset (Logo)**: The Vaultfolio logo image, reused in multiple presentations — favicon, touch icon, header mark, README image.
- **Brand Accent Color**: The primary interactive color and its shade scale, derived from the brand asset, applied to themed UI elements.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: 100% of the application's routes produce a browser tab title starting with "Vaultfolio" (either "Vaultfolio - <Page>" or plain "Vaultfolio"); zero routes show the old generic "frontend" title.
- **SC-002**: A user can identify the correct application among multiple open browser tabs within 1 second, using the tab icon and title alone.
- **SC-003**: The Vaultfolio logo appears in exactly the intended surfaces (favicon, touch icon, header, README) with no duplicated or leftover placeholder brand marks elsewhere in the UI.
- **SC-004**: 100% of primary buttons, links, and focus indicators sampled across the app's main pages use the brand accent color rather than the prior default color, in both light and dark mode.

## Assumptions

- "Vaultfolio" is the finalized product name used in all user-facing branding text (tab titles, header wordmark, README).
- The Vaultfolio logo asset already exists and its dominant/icon color is the intended source for the new brand accent color; no separate brand color was specified independently of the logo.
- Per-route page names are short, static, human-readable strings (not translated/localized) — internationalization of titles is out of scope.
- The header remains the single, persistent home for brand identity across all viewport sizes (including the collapsed/mobile sidebar layout), so removing the sidebar's brand mark does not regress brand visibility.
- Favicon and touch-icon formats/sizes follow standard browser conventions and do not require multiple resolutions beyond what a single logo asset provides.
