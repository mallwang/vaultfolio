# Design: Klaro Navigation Entry

**Mockup**: [mockup.html](./mockup.html) (durable local copy) — originally reviewed at
https://claude.ai/code/artifact/73885fbf-00f9-4179-a160-81c29e220726 (this remote link may go
stale; the local copy is the source of truth).

## Summary

A new side-nav entry, "Klaro", added to the existing app-shell navigation (sidebar + header),
positioned after Account Overview and before Settings — matching the precedent set when the five
placeholder domains were inserted after Holdings and before Settings (022-add-domain-placeholders).
Unlike every other nav entry, it uses Klaro's own logo mark instead of an outline icon (FR-002).
Selecting it opens a static informational page inside Vaultfolio — it does not embed any real
Klaro functionality in this iteration.

## Layout per region

### App shell (reused, not new)

Sidebar (left, 232px desktop / horizontal scrollable top bar on mobile) + header (crumb
"Vaultfolio", page title "Klaro", user meta/theme-toggle/sign-out), unchanged from the existing
`app-shell`/`app-sidebar`/`app-header` components (`apps/frontend/src/app/core/layout/`). A new
entry is added to `APPLICATION_AREAS` (`application-areas.ts`) between `account-overview` and
`settings`.

### Sidebar — Klaro nav item (FR-001, FR-002)

Same `.app-nav__item` shape as every other entry (icon/mark + label, active-state left accent bar,
collapses to icon-only on a collapsed/mobile sidebar), but the icon slot holds Klaro's own logo
mark rather than a Material Symbols glyph. The mockup uses a placeholder teal "K" mark (Klaro's
brand color, kept visually distinct from Vaultfolio's indigo primary) — the real Klaro
logo/wordmark asset needs to be sourced from the Klaro project before implementation swaps it in
(see spec.md Assumptions).

### Content region — Klaro info page (FR-003–FR-009)

Single-column page (no tabs/wizard), top to bottom:

- **Hero**: Klaro's mark + "Klaro" + a one-line subtitle ("Contract & subscription management").
- **Description paragraph**: plain-language explanation of what Klaro does (FR-004).
- **Feature-highlight list**: four short bullets (spend/category breakdown, renewal alerts,
  contract table, JSON/Excel export-import) — supporting detail for FR-004, not itself a
  requirement; content-only, not a structural constraint.
- **Standalone-app banner**: a highlighted callout stating Klaro is currently its own, separate
  application (FR-005).
- **External link**: a button-styled link "Open Klaro ↗" to https://klaro.allwang.family/, opening
  in a new tab, with a small caption noting the Vaultfolio session stays open (FR-006).
- **"Where this is headed" card**: three labeled rows —
  - **Today**: users must create a separate account directly in Klaro (FR-008).
  - **Sync**: future data synchronization requires the identical email address in both accounts
    (FR-009).
  - **Future**: Klaro's full functionality will move into Vaultfolio under this same nav entry
    (FR-007).

### Responsive behavior

Desktop (1180px+): sidebar on the left, 2-column feature-highlight grid. Mobile (~400px): sidebar
collapses to the existing horizontal scrollable top bar (unchanged mechanism), feature-highlight
grid drops to a single column, page content remains single-column throughout.

## Requirement traceability

| Spec item      | Region                                                                                       |
| -------------- | -------------------------------------------------------------------------------------------- |
| FR-001, FR-002 | Sidebar Klaro nav item (logo mark, placement, active state)                                  |
| FR-003         | Nav item routes to the Klaro info page (interaction, not visual)                             |
| FR-004         | Hero + description paragraph + feature-highlight list                                        |
| FR-005         | Standalone-app banner                                                                        |
| FR-006         | External link button + caption                                                               |
| FR-007         | "Where this is headed" card — Future row                                                     |
| FR-008         | "Where this is headed" card — Today row                                                      |
| FR-009         | "Where this is headed" card — Sync row                                                       |
| FR-010         | Reuse of existing sidebar entitlement/access mechanism (logic, out of scope for this mockup) |
| FR-011         | Absence of any account-data field/form anywhere on the page                                  |

## Out of scope for this mockup

- The real Klaro logo/wordmark asset — a placeholder teal "K" mark stands in until the actual
  brand asset is sourced.
- The broken-image fallback behavior for the logo mark (Edge Cases) — interaction/logic detail.
- The access-denied behavior for a user without entitlement to this nav entry (Edge Cases) —
  interaction/logic detail, not layout.
- Exact wording/count of the feature-highlight bullets — illustrative content, not a requirement.

## Visual language note

Approximates PrimeNG's default "Aura" preset (light) — Vaultfolio has no theme file wired up as of
this feature (see `specs/010-theme-switch/design.md`'s identical note). Klaro's brand teal
(`#0ea5a3`) is a placeholder accent used only for the Klaro nav mark and the info page's Klaro-
specific accents (banner, roadmap badges); it does not affect Vaultfolio's own primary color
anywhere else in the app. Exact design tokens — both Vaultfolio's and, once available, Klaro's
real brand color — will be finalized during planning/implementation.
