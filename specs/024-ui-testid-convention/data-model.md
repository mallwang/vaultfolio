# Phase 1 Data Model: UI Test-ID Convention

This feature introduces no persisted entities, database tables, or API DTOs — it is a documentation
convention plus template attribute additions. The "entities" below are conceptual, describing the
shape of the convention itself (used to drive the contract and quickstart), not runtime data.

## Testid Rule (conceptual)

Describes one row of the convention's decision table.

| Field        | Description                                                                                                                              |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `category`   | Which FR-002 category the rule covers: `static`, `repeated`, `shared`, or `exempt` (FR-003 elements that already have a stable selector) |
| `pattern`    | The naming template, e.g. `<area>-<element>`, `<area>-<item-type>-row-<key>`                                                             |
| `key_source` | For `repeated` only: where the distinguishing key comes from — a data item's natural id, or the index fallback                           |
| `example`    | A concrete instantiation of the pattern used in the doc and in acceptance testing (SC-003)                                               |

## Grandfathered Testid

Describes the two pre-existing values and their disposition.

| Field               | Value                                                                                                                                                        |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `language-switcher` | Category: static, top-level app-shell control. Disposition: kept as-is, conforms (no `<area>-` prefix needed — it's already unambiguous at app-shell scope). |
| `theme-toggle`      | Category: static, top-level app-shell control. Disposition: kept as-is, same reasoning.                                                                      |

## Retrofit Item (tracking concept for User Story 2, not a stored entity)

Each in-scope UI element found during the retrofit pass is conceptually:

| Field                 | Description                                                                     |
| --------------------- | ------------------------------------------------------------------------------- |
| `file`                | Template file path                                                              |
| `element_description` | What the element is (e.g. "delete button in holdings row")                      |
| `category`            | Which FR-002 category triggered inclusion                                       |
| `assigned_testid`     | The value chosen per the convention                                             |
| `verified_inert`      | Whether existing unit tests / visual behavior were confirmed unchanged (FR-007) |

This table is not persisted anywhere — it exists only as the implementer's/tasks.md working list
while performing the retrofit; no schema or migration is introduced.

## State Transitions

None — this feature has no stateful entity or workflow; templates are edited once (attribute added)
and the convention document is authored once (then maintained via normal doc edits going forward).
