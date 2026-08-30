# Design: App Shell Restructure

**Mockup**: [mockup.html](./mockup.html) (local, durable copy) — originally reviewed at
https://claude.ai/code/artifact/bd4bce60-5720-415d-add9-a31abdaf367c (Artifact link may go stale).

## Approach

Approximates PrimeNG's default "Aura" preset using the same token palette already approved in the
003/006/007/008 mockups, so this reads as the same app rather than a new one. No visual redesign
was in scope — the mockup exists to confirm structure (what's present, where) for the two shell
states, not to introduce new styling.

## States reviewed

### Signed out — public page (e.g. `/sign-in`)

- **Header**: present, showing only the Vaultfolio brand mark/name and "Not signed in" — no user
  name, role badge, or sign-out control. Satisfies FR-001, FR-003, FR-009.
- **Sidebar**: absent. Satisfies FR-006.
- **Content**: the page's own content (sign-in form shown as a representative example) fills the
  area below the header.

### Signed in — authenticated page (e.g. `/app/dashboard`)

- **Sidebar**: present at the left (232px fixed column on desktop, collapsing to a horizontal
  scrollable top bar on mobile — reusing the existing `app-sidebar` breakpoint behavior). Lists
  the four authenticated areas (Dashboard, Holdings, Imports, Settings). Satisfies FR-004, FR-005.
- **Header**: present at the top of the remaining column, showing crumb + page title on the left,
  and on the right: the user's display name, a role badge, an avatar, and a sign-out control.
  Satisfies FR-001, FR-002, FR-008.
- **Content**: page-specific content fills the area below the header, to the right of the sidebar.

## Layout notes

- Sidebar + header + content form a grid: `232px 1fr` columns, with the header and content
  stacked in the right column — this matches the existing `app-shell.component.css` grid, just
  with the header now also rendering (unchanged) for the signed-out case where the grid isn't
  used at all (no sidebar column).
- Mobile: sidebar collapses to a horizontal top bar above the header (existing
  `app-sidebar.component.css` breakpoint), and the header's meta row hides the display name,
  keeping only the role badge, avatar, and sign-out control, to fit narrow widths.
- A CSS bug was caught and fixed during review: the mockup's generic state-visibility rule
  (`display: block`) initially overrode the signed-in block's own `display: grid`, stacking the
  sidebar above the header/content instead of beside it. Fixed with a more specific selector
  restoring `display: grid` for that state. Worth remembering when implementing the real
  route-based shell toggle: whatever conditionally shows/hides the shell must not clobber the
  shell's own grid `display` value.

## Traceability

| Region / state                                           | Requirement(s)                                                          |
| -------------------------------------------------------- | ----------------------------------------------------------------------- |
| Header always present                                    | FR-001                                                                  |
| Authenticated pages under `/app`                         | FR-002 (not visually distinguishable in the mockup — a routing concern) |
| Public pages directly under base URL                     | FR-003 (routing concern)                                                |
| Sidebar visible when signed in                           | FR-004, FR-005                                                          |
| Sidebar absent when signed out                           | FR-006                                                                  |
| Sign-out hides sidebar/identity again                    | FR-007 (behavioral — not a distinct visual state)                       |
| Header shows name + role badge + sign-out when signed in | FR-008                                                                  |
| Header shows no identity when signed out                 | FR-009                                                                  |
| Sign-out ends session                                    | FR-010 (behavioral)                                                     |
| Redirect from `/app/*` when unauthenticated              | FR-011 (behavioral, not visual)                                         |
| Existing access control preserved                        | FR-012 (behavioral)                                                     |
| Legacy links to old addresses keep working               | FR-013 (behavioral, not visual)                                         |

## Out of scope for this mockup

- Legacy-address redirects (FR-013) — a routing behavior with no visual difference to review.
- Session-expiry redirect handling (Edge Cases) — no distinct visual state.
- The other public pages (sign-up, invite accept/expired, account/*) — they follow the same
  "header present, no sidebar" pattern shown here for sign-in; not each mocked up individually.
- Any new visual styling of the header or sidebar beyond what's needed to show/hide them
  correctly — this feature is about visibility, placement, and structure per the spec's
  Assumptions section.
