# Design: Notification Center

**Mockup**: [mockup.html](./mockup.html) (durable local copy, approved after one review round; no published Artifact link). All names and data in the mockup are invented.

## Summary

A notifications bell with a count badge sits in the authenticated header, before the language switcher and theme toggle. It opens a panel listing active hints grouped by source feature, with a collapsible "Ausgeblendet" section. On mobile the panel becomes a modal with a dimmed backdrop (no separate page). German UI text.

## Layout per region

### Bell and badge (US1, US2; FR-001, FR-002, FR-014)

- Material "notifications" icon button, accessible name "Hinweise" (with the count when > 0, e.g. "Hinweise, 3 offen").
- Red count badge for active hints only; counts above 9 show "9+".
- No active hints but at least one hidden: small gray dot instead of a number. No hints at all: plain bell.

### Panel (US1, US2; FR-003, FR-006)

- Desktop: popover anchored below the bell, ~400 px wide, scrolls when long; close button in the header.
- Groups by source feature (group title), warnings before info within the list; each hint has a severity icon, title, description, a link to the target, and "Ausblenden".
- Empty state: check mark with "Keine offenen Hinweise".
- Footer line explaining that hidden hints do not count and reactivate on change.

### Hidden section (US2; FR-006, FR-008)

- Collapsible row "Ausgeblendet (n)" below the active list, shown only when n > 0.
- Hidden hints use the same layout, slightly dimmed, with "Einblenden".

### Mobile (US1, US2)

- Panel is a centered modal (~78% max height) over a dimmed backdrop; closes via close button or backdrop click.

## Requirement traceability

| Region                 | Spec coverage                                     |
| ---------------------- | ------------------------------------------------- |
| Bell and badge         | US1 scenarios 1-2, US2 scenarios 1, 4; FR-001/002 |
| Panel and hint rows    | US1 scenarios 3-4; FR-003, FR-014                 |
| Hidden section         | US2 scenarios 1-3, 5-6; FR-006/007/008            |
| Empty and many states  | US1 scenario 2; edge case "many hints"            |
| Feedback draft example | US3 / spec 044 dependency                         |

## Out of scope for the mockup

Provider contract and registration (FR-004), local persistence and per-user keying of hidden state (FR-007), content signature and reactivation logic (FR-008), maintenance-mode and entitlement filtering (FR-009), provider failure isolation (FR-010), insurance and earnings detection (FR-011/012), i18n (FR-013), test ids (FR-015).

## Visual language

Approximates the PrimeNG Aura defaults (emerald primary, slate neutrals); exact tokens follow the real theme at implementation. The mockup uses an inline SVG for the Material notifications icon; the real implementation uses the app's icon component.
