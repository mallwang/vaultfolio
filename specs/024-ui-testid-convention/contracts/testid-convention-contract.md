# Contract: `data-testid` Naming Convention

This is the "interface" this feature exposes: not an API, but a documented contract between (a) any
template author (human or agent) and (b) any Playwright verification script. It is the authoritative
spec for the content that must end up in `docs/frontend/testid-conventions.md` (the deliverable of
User Story 1 / FR-001–FR-005).

## 1. Attribute

- Attribute name: `data-testid` (plain HTML attribute, or `[attr.data-testid]` Angular binding when
  the value must be computed).
- Value type: string, kebab-case, ASCII `[a-z0-9-]`.
- Playwright lookup: `page.getByTestId('<value>')` (Playwright's default `data-testid` test-id
  attribute — no `playwright.config.ts` change needed, per spec Assumptions).

## 2. Decision table (governs FR-002 / FR-003)

| Situation                                                                                                    | Needs `data-testid`?             | Naming pattern                                                                                                                                                                                             |
| ------------------------------------------------------------------------------------------------------------ | -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Interactive element, only label is translated (i18n) text                                                    | Yes                              | `<area>-<element>`                                                                                                                                                                                         |
| Interactive element already has a stable non-translated selector (DOM `id`, `formControlName`, `routerLink`) | No                               | n/a — do not add a redundant testid                                                                                                                                                                        |
| Repeated list/table row or item                                                                              | Yes, one per rendered instance   | `<area>-<item-type>-row-<key>` (`<key>` = natural id; `<area>-<item-type>-row-idx-<i>` fallback if no natural id, documented as unstable across reorders)                                                  |
| Interactive node inside a UI-library (PrimeNG) wrapper, no other stable selector reaching it                 | Yes                              | Same pattern as the element's own category (static/repeated/shared); placed on the host tag unless it doesn't forward to the real DOM node (see research.md §3), in which case on the actual rendered node |
| Component reused across more than one screen/context                                                         | Yes (each usage distinguishable) | Component owns its own base testid; call site passes a distinguishing prefix (e.g. `testIdPrefix` input) so usage A and usage B render different final values                                              |
| Element inside a dynamically shown/hidden overlay (e.g. PrimeNG dialog)                                      | Yes, if otherwise qualifying     | Testid lives on the actual rendered node inside the overlay content, so it only exists in the DOM while mounted — no stale/duplicate node in the closed state                                              |

## 3. Grandfathered values

`language-switcher` and `theme-toggle` (both in
[app-header.component.html](../../../apps/frontend/src/app/core/layout/app-header/app-header.component.html))
are confirmed conformant as top-level, non-repeated, non-shared-in-conflicting-context static
elements — kept as-is, no rename (satisfies FR-004).

## 4. Consumers of this contract

- **Template authors** (User Story 2 retrofit, User Story 3 ongoing work): follow the decision table
  above when writing or editing a template.
- **`verify-ui` skill** (FR-009): its "Selector conventions" list must link to
  `docs/frontend/testid-conventions.md` and instruct: if an in-scope element is missing a testid,
  add one per this contract rather than falling back to translated-text matching.
- **`CLAUDE.md`** (FR-008): must instruct that implementing/changing a UI element meeting the
  decision table's "needs a testid" rows includes adding the attribute in the same change.

## 5. Non-goals

- No lint rule, ESLint plugin, or CI check enforcing this contract is introduced by this feature
  (would be a separate, larger decision — see Complexity Tracking / Principle V simplicity gate in
  plan.md, which found no such requirement in the spec).
- No committed Playwright/e2e spec file is added (see spec Assumptions).
