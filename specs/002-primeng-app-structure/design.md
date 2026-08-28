# Design: PrimeNG UI Foundation & Application Structure

**Feature**: [spec.md](./spec.md)
**Status**: Approved

## Approach

A persistent two-region app shell — a left sidebar navigation and a header + content area —
hosts every top-level application area. On narrow viewports the sidebar collapses into a
horizontal, scrollable top bar of icon+label chips rather than disappearing, so navigation stays
reachable per FR-009.

```
Desktop (≥ ~768px)                    Mobile
┌───────────┬───────────────────┐     ┌───────────────────────────┐
│  Vaultfolio│  Crumb            │     │ 🏷  🏠 📊 ⬆ ⚙  (scroll →) │
│           │  Area title    ⓤ  │     ├───────────────────────────┤
│ ▌Dashboard│                   │     │  Crumb                    │
│  Holdings │  [ content ]      │     │  Area title            ⓤ │
│  Imports  │                   │     │                           │
│  Settings │                   │     │  [ content ]              │
└───────────┴───────────────────┘     └───────────────────────────┘
```

## Regions & states

- **Sidebar navigation** (`.app-sidebar` / `.app-nav`) — satisfies FR-003, FR-009. One entry per
  top-level area (Dashboard, Holdings, Imports, Settings), each with an inline SVG icon and label.
  The active entry is marked via `aria-current="page"` with a left accent bar (desktop) or a
  filled chip (mobile) — satisfies the "indicates the active area" part of Acceptance Scenario 2
  under User Story 2.
- **Header** (`.app-header`) — shows a small "Vaultfolio" eyebrow/crumb plus the active area's
  title; a user-identity affordance sits on the right (placeholder avatar/name) as a natural home
  for future account/settings entry points, though account features are out of scope here.
- **Content region** (`.app-content`) — swaps per area while the shell persists, satisfying
  Acceptance Scenario 2 under User Story 2 and FR-004.
- **Dashboard** (FR-005) — three placeholder stat cards (Total value / Today's change /
  Allocation) rendered as "— pending —" plus an empty-state panel explaining the area is not yet
  built. The stat cards establish the layout future data will fill without over-promising content.
- **Holdings** (FR-005) — a table shell with real column headers (Ticker, Name, Quantity, Value)
  and an empty-state row, so the eventual data table has an established frame.
- **Imports** (FR-005) — a dropzone-style empty state, signaling the eventual file-import
  interaction without implementing it.
- **Settings** (FR-005, FR-007) — two stacked sections: "System health" (the relocated
  health-status screen, showing the same healthy/latency-per-check shape as today) and a
  "Preferences" placeholder marked "Coming soon". Confirms the existing health-status
  functionality has a home in the new structure without being duplicated or dropped.
- **Not found** (FR-006) — a centered icon + message + "Back to Dashboard" action, rendered inside
  the same app shell (sidebar still present) rather than a bare/blank page.

## Requirement traceability

| Spec item                                | Region/state                                                                                                                                              |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-001, FR-002, FR-010                   | Overall visual language (buttons, cards, table, pills) — approximated here, finalized when PrimeNG theming is configured (see Visual language note below) |
| FR-003                                   | Sidebar navigation                                                                                                                                        |
| FR-004                                   | Content region swap, shell persistence                                                                                                                    |
| FR-005                                   | Dashboard / Holdings / Imports / Settings placeholder states                                                                                              |
| FR-006                                   | Not-found state                                                                                                                                           |
| FR-007                                   | Settings → System health section                                                                                                                          |
| FR-009                                   | Mobile viewport toggle — sidebar collapses to a scrollable top bar                                                                                        |
| User Story 1 (Acceptance Scenario 1 & 2) | All regions render via one consistent component/style set                                                                                                 |
| User Story 2 (Acceptance Scenario 1–3)   | Sidebar + header + not-found state                                                                                                                        |
| User Story 3                             | This design.md itself, plus `templates/review-shell.html` / `mocked-app-header.example.html` as the reusable pattern for adding the next placeholder area |

## Out of scope for this mockup

- **FR-008** (documenting the structure in a README/contributor guide) — a docs deliverable, not
  a layout concern; handled in `/speckit-plan`/`/speckit-tasks`, not mocked here.
- **FR-010**'s accessibility requirements beyond visual contrast (keyboard navigability,
  reduced-motion/high-contrast preferences) — behavioral, verified in the real implementation.
- Theme-load-failure fallback (Edge Cases) — a resilience behavior, not a layout one.
- Real routing, auth, and any live portfolio data — every screen here is a static placeholder.

## Visual language note

PrimeNG is the confirmed component library (constitution + spec Assumptions), but theming isn't
configured in `apps/frontend` yet as of this feature. This mockup approximates PrimeNG's default
**Aura** preset (indigo primary `#5b5fef`, neutral cool grays, pill-shaped status badges) so the
reviewed layout doesn't mislead about the eventual look, but exact design tokens (colors, radii,
spacing scale) are expected to be finalized once `/speckit-plan` wires up PrimeNG and its theme.

## Mockup

Local copy (durable): [mockup.html](./mockup.html)
Original Artifact (may go stale): https://claude.ai/code/artifact/5af05df0-6391-433b-80f6-657dc29a75f4
