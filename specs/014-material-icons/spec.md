# Feature Specification: Material Icons as Default Icon Library

**Feature Branch**: `014-material-icons`

**Created**: 2026-08-31

**Status**: Draft

**Input**: User description: "I would like to use material icons (google) as the default library for showing icons and replace the primeng icons entirely (like described in https://primeng.dev/customicons). Please also constitute this in the tech stack."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Consistent icon visuals across the app (Priority: P1)

As a user of Vaultfolio, I see one consistent, modern icon style everywhere in the app — navigation, buttons, tables, forms, alerts — rather than a mix of icon styles, so the interface feels coherent and polished.

**Why this priority**: This is the entire point of the change. Every screen in the app renders icons somewhere (nav, actions, status indicators), so visual consistency is the core value delivered and the most visible outcome to users.

**Independent Test**: Navigate through every major area of the app (dashboard, holdings, admin, auth, profile) and confirm all icons render from the same visual family with no leftover icon glyphs from the old style.

**Acceptance Scenarios**:

1. **Given** the user is on any page of the app, **When** they view an icon (in navigation, a button, a table action, an alert, or a form field), **Then** the icon is rendered from the new icon set and visually matches the style of every other icon on the page.
2. **Given** a page previously used an icon from the old icon set, **When** the page is viewed after this change, **Then** the equivalent icon now renders from the new icon set with no missing, broken, or placeholder icon glyphs.

---

### User Story 2 - No visual regression in icon-driven components (Priority: P2)

As a user, when I interact with components that rely on icons for meaning (e.g., a close button, an expand/collapse arrow, a success/error indicator, a sort arrow in a table), the icon still clearly communicates the same meaning as before, just in the new visual style.

**Why this priority**: Icons are frequently the only visual cue for an interactive affordance (e.g., a chevron to expand a row). If an icon's meaning is unclear after the switch, users lose the ability to operate the interface correctly — this is a functional risk, not just a cosmetic one.

**Independent Test**: Exercise each interactive control that depends on an icon (dropdowns, dialogs, table sorting/pagination, alerts/toasts, form validation icons) and confirm each renders a recognizable icon that conveys the same meaning as its prior counterpart.

**Acceptance Scenarios**:

1. **Given** a UI control whose meaning is conveyed primarily through an icon (e.g., delete, edit, close, expand), **When** the user views that control after the change, **Then** the new icon clearly conveys the same action or state as the icon it replaced.
2. **Given** an icon is used to indicate status (e.g., success, warning, error, info), **When** the user views that status indicator, **Then** the icon's meaning remains immediately recognizable and distinct from other statuses.

---

### User Story 3 - Icon choice is documented for future work (Priority: P3)

As a developer or maintainer working on Vaultfolio after this change, I can find a clear, authoritative statement of which icon library the project uses, so I don't accidentally reintroduce the old icon set or add a third, competing one in new features.

**Why this priority**: Without a documented decision, future work risks silently drifting back to mixed icon usage, undoing the consistency this feature establishes. This is lower priority than the user-facing outcomes but necessary for the change to stick.

**Independent Test**: Check the project's authoritative technology/architecture documentation and confirm it names the new icon library as the sole, standard choice for icons going forward.

**Acceptance Scenarios**:

1. **Given** a new feature is being planned that needs an icon, **When** the developer consults the project's technology stack documentation, **Then** they find a clear statement identifying the required icon library and no mention of the old one as an accepted option.

### Edge Cases

- What happens to an icon that exists in the old icon set but has no equivalent named icon in the new set? (Assumed: the closest visual/semantic equivalent from the new set is chosen; see Assumptions.)
- How does the app handle an icon referenced by name in application code that doesn't exist in the new icon set (e.g., a typo or unmapped icon)? The interface must not show a broken/empty icon silently — a fallback or clearly visible gap should make the issue noticeable during development/testing rather than reaching users unnoticed.
- Do icons continue to scale, color, and align correctly wherever they previously did (buttons of different sizes, dark/light theme, disabled states)?
- Are there any icons rendered from third-party/vendor UI components (outside the app's own code) that cannot be swapped, and if so, is that acceptable as a known exception?

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The system MUST render all icons in the application's user interface using a single, consistent icon library (Google's Material Icons) instead of the icon set currently used.
- **FR-002**: The system MUST NOT retain any use of the previous icon set anywhere in the user-facing interface after the change is complete — every icon reference is switched over, not partially migrated.
- **FR-003**: Every icon currently shown to users MUST have a replacement icon from the new library that conveys the same meaning or action (e.g., delete, edit, close, expand/collapse, success/warning/error/info, sort, navigation).
- **FR-004**: Icons MUST continue to visually scale, align, and adapt to color/theme (including light/dark mode and disabled states) consistently with how the rest of the interface already adapts.
- **FR-005**: Interactive components whose behavior or meaning depends on an icon (buttons, table actions, alerts, form validation, navigation) MUST retain their existing meaning and behavior after the icon swap — only the visual icon changes, not the functionality.
- **FR-006**: The project's authoritative technology/architecture reference MUST be updated to name the new icon library as the required, standard choice for icons, so future feature work is not built against the old icon set.
- **FR-007**: The system SHOULD provide a visibly detectable fallback (rather than a silent blank icon) when an icon name used in the interface has no match in the new icon library, so gaps are caught during development rather than shipped unnoticed.
- **FR-008**: Icons used purely for decoration MUST remain non-disruptive to assistive technology (e.g., not read aloud as meaningless noise), and icons that convey meaning on their own MUST remain identifiable to assistive technology users, consistent with the accessibility level already provided by the current icon usage.

### Key Entities

_No new data entities are introduced by this feature — it is a UI presentation change affecting how existing interface elements render icons._

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: 100% of icons visible anywhere in the application render from the new icon library; zero instances of the previous icon set remain detectable in the rendered UI.
- **SC-002**: Every interactive control that relied on an icon for its meaning (delete, edit, expand, sort, status, etc.) is independently verified to still convey the same meaning and remain fully operable after the change.
- **SC-003**: A person unfamiliar with the change, reviewing the app's screens, cannot identify any page where icon style looks inconsistent with the rest of the app.
- **SC-004**: A developer reading the project's technology stack documentation can, within one lookup, confirm which icon library is the standard for the project without ambiguity.

## Assumptions

- "Material Icons (Google)" refers to Google's Material Symbols/Material Icons font-based or SVG icon set, used as a full replacement for PrimeIcons across the application, following the icon-swap approach PrimeNG documents for supplying custom icons to its components.
- Where no exact one-to-one icon name match exists between PrimeIcons and Material Icons, the closest icon that preserves the same user-facing meaning is selected during implementation; this substitution does not require a product decision per icon.
- This change is purely a presentation-layer swap: no new user-facing functionality, data, or navigation is introduced, and no existing functionality is removed.
- Any third-party/vendor component that renders its own icons internally without exposing an icon-customization mechanism is out of scope for this feature and is treated as a known, documented exception rather than a blocker.
- The "tech stack" documentation to update is the project's constitution/technology-stack reference maintained via the project's `/speckit-constitution` process; updating it is an explicit part of this feature's definition of done, alongside the code change itself.
