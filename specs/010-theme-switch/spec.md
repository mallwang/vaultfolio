# Feature Specification: Light/Dark Theme Switch

**Feature Branch**: `010-theme-switch`

**Created**: 2026-08-30

**Status**: Draft

**Design**: [design.md](./design.md) — approved mockup: an icon-only sun/moon toggle next to the sign-out button.

**Input**: User description: "I would like to add a light theme / dark theme switch in the application. There should be a button in the navigation bar beneath the sign-out button, so that unauthenticated and authenticated users can switch the theme."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Switch theme from the navigation bar (Priority: P1)

Any visitor to Vaultfolio, whether signed in or not, can use a control in the navigation bar to switch the application's appearance between a light theme and a dark theme. The change applies immediately, without needing to reload the page.

**Why this priority**: This is the entire feature — a single, always-available control that lets any visitor change the appearance to their preference. Without it there is no feature.

**Independent Test**: Can be fully tested by opening the app as an unauthenticated visitor, activating the theme control, and confirming the page's appearance switches between light and dark. Repeating this while signed in confirms it works identically for authenticated users.

**Acceptance Scenarios**:

1. **Given** a visitor is not signed in and viewing a public page, **When** they activate the theme control in the navigation bar, **Then** the page's appearance switches from light to dark (or dark to light) immediately.
2. **Given** a signed-in user is viewing an authenticated page, **When** they activate the theme control in the navigation bar, **Then** the page's appearance switches immediately, and the control appears next to the sign-out button.
3. **Given** a visitor is not signed in, **When** they view the navigation bar, **Then** the theme control is visible and usable even though no sign-out button is present for them.

---

### User Story 2 - Theme choice is remembered (Priority: P2)

A visitor who has picked a theme continues to see that theme the next time they use Vaultfolio in the same browser, without needing to switch it again.

**Why this priority**: Re-selecting a preference on every visit is a friction most users would find frustrating, but the app is still usable without persistence, so this is a strong enhancement rather than core to the feature's function.

**Independent Test**: Can be fully tested by switching to dark theme, closing and reopening the browser (or reloading the app in a new tab), and confirming dark theme is still applied without further action.

**Acceptance Scenarios**:

1. **Given** a visitor switched to dark theme, **When** they reload the page or return in a new browser tab, **Then** the application still displays in dark theme.
2. **Given** a visitor has never chosen a theme, **When** they first open the application, **Then** the application displays using a sensible default theme.

---

### User Story 3 - Theme applies consistently across the whole application (Priority: P2)

Once a visitor selects a theme, that theme is reflected consistently across every screen of the application — public pages and authenticated pages alike — rather than only the page where the switch was made.

**Why this priority**: A theme that only affects the current page (or only public or only authenticated pages) would feel broken and inconsistent, but this builds on User Story 1 rather than being independently the core deliverable.

**Independent Test**: Can be fully tested by switching the theme on a public page, then navigating to an authenticated page (or vice versa), and confirming the selected theme is applied on every page visited.

**Acceptance Scenarios**:

1. **Given** a visitor switched to dark theme on a public page, **When** they sign in and view an authenticated page, **Then** the authenticated page is also displayed in dark theme.
2. **Given** a signed-in user switched to light theme on an authenticated page, **When** they sign out and view a public page, **Then** the public page is also displayed in light theme.

---

### Edge Cases

- What happens when a visitor's browser blocks or clears local storage of preferences? The application MUST fall back to the default theme without erroring.
- What happens when the visitor's operating system or browser has a system-level dark mode preference set? The application uses that as the initial default if the visitor has not made an explicit choice (see Assumptions).
- How does the control behave for visitors using assistive technology (e.g. screen readers, keyboard-only navigation)? The control MUST be operable via keyboard and MUST announce its current state and purpose.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The application MUST provide a control in the navigation bar that lets any visitor toggle between a light theme and a dark theme.
- **FR-002**: The theme control MUST be an icon-only button (no text label) positioned next to the sign-out button in the navigation bar for authenticated users, keeping the header compact for future controls in the same area (e.g. a language switch).
- **FR-003**: The theme control MUST be visible and usable to unauthenticated visitors, in the equivalent position in the navigation bar, even though they have no sign-out button.
- **FR-004**: Activating the theme control MUST change the application's visual appearance immediately, without a full page reload.
- **FR-005**: The application MUST persist a visitor's explicit theme choice in their browser so it is remembered on subsequent visits in that browser.
- **FR-006**: The application MUST apply the selected theme consistently to every page, both public/unauthenticated pages and authenticated pages.
- **FR-007**: When a visitor has not made an explicit theme choice, the application MUST default to the visitor's operating system/browser theme preference if it can be detected, and otherwise MUST default to the light theme.
- **FR-008**: The theme control MUST be operable via keyboard and MUST expose its current state (light or dark) and purpose to assistive technologies.
- **FR-009**: The theme control MUST clearly indicate which theme is currently active.

### Key Entities

- **Theme Preference**: The visitor's chosen appearance mode (light or dark), stored per-browser; not tied to a signed-in account or shared across devices.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A visitor can switch the application's theme in one interaction with the navigation bar control, in under 1 second of visual change.
- **SC-002**: 100% of pages in the application (public and authenticated) reflect the visitor's selected theme.
- **SC-003**: A visitor's theme choice persists across at least 95% of return visits in the same browser (allowing for edge cases like cleared browser storage).
- **SC-004**: The theme control is usable by keyboard-only and screen-reader users, verified with no accessibility violations related to the control.

## Assumptions

- Theme preference is a per-browser setting stored client-side; it is not saved to a user's account or synced across devices/browsers. This can be revisited in a future iteration if cross-device sync is desired.
- Only two themes are in scope: light and dark. No additional custom themes are required.
- The default theme for first-time visitors follows the operating system/browser's reported preference (`prefers-color-scheme`) when available, falling back to light theme otherwise.
- The navigation bar layout referenced (sign-out button, with the theme control next to it) is the one established by the existing app shell; unauthenticated visitors see the same navigation bar structure minus the sign-out button, with the theme control in the equivalent position.
