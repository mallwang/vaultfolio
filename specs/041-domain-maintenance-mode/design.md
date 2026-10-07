# Design: Domain Maintenance Mode

**Mockup**: [mockup.html](./mockup.html) (durable local copy, approved as-is in the first review
round; no published Artifact link). All names and data in the mockup are invented.

## Summary

Admins get a new "Domänen" tab under Verwaltung to switch single domains into maintenance. Members
keep the navigation item (with a small wrench icon) and see an orange maintenance notice on the
domain page and on the dashboard tile. Admins keep full access and see an indication. German UI text.

## Layout per region

### Admin tab "Domänen" (US1; FR-001, FR-002, FR-016)

- New tab in the admin tab bar, after "Anfragen". Intro text explains the effect.
- Table: Domäne (icon + name), Status tag (Aktiv green / In Wartung orange), Zuletzt geändert (date,
  time, admin; hidden on mobile), switch "Wartungsmodus".
- Switching on opens a confirmation dialog (cancel / "In Wartung setzen"); switching off needs none.

### Navigation (US2; FR-007, FR-011)

- Item stays visible for entitled members; an orange wrench marks maintenance. Domains the member is
  not entitled to stay hidden regardless of state.

### Dashboard tile (US2, US4; FR-009, FR-010, FR-012)

- Member: orange-tinted tile with wrench icon, "Wartungsarbeiten" and a short text instead of content.
- Admin: normal tile content plus the badge "In Wartung – für Member nicht sichtbar".
- Implemented as a shared tile variant next to the empty tile.

### Domain page (US2, US4; FR-008, FR-006, FR-010)

- Member: centered orange notice (icon in a circle, heading, text), analogous to the empty retirement
  state but in orange; replaces the domain content.
- Admin: regular domain content with an orange banner at the top.
- Implemented as a shared page-notice component.

### Mobile

Table drops the "Zuletzt geändert" column; tiles stack; sidebar becomes a horizontal bar.

## Requirement traceability

| Region              | Requirements                           |
| ------------------- | -------------------------------------- |
| Admin tab           | FR-001, FR-002, FR-003, FR-016, FR-017 |
| Navigation          | FR-007, FR-011                         |
| Dashboard tile      | FR-009, FR-010, FR-012                 |
| Domain page         | FR-006, FR-008, FR-010, FR-012         |
| Not mockup-relevant | FR-004, FR-005, FR-013, FR-014, FR-015 |

## Out of scope for the mockup

API rejection response, reminder pause and catch-up, audit log storage and viewing, data
preservation. Visual language approximates the PrimeNG Aura preset used by the app.
