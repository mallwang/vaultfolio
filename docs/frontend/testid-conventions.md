# Frontend `data-testid` Naming Convention

This document is the authoritative naming convention for `data-testid` attributes across the
Angular frontend (`apps/frontend` and the `libs/frontend/domain/*` / `libs/frontend/admin`
libraries). Follow it whenever you add or change an interactive UI element that needs a stable,
locale-independent test selector. It is written so a contributor or agent can derive the correct
`data-testid` (or correctly conclude none is needed) without asking a maintainer.

## 1. The attribute

- Attribute name: `data-testid` — a plain HTML attribute (`data-testid="..."`), or an Angular
  `[attr.data-testid]="..."` binding when the value must be computed (e.g. per-row values).
- Value type: string, kebab-case, ASCII `[a-z0-9-]` only.
- Playwright lookup: `page.getByTestId('<value>')`. This is Playwright's default `data-testid`
  test-id attribute — no `playwright.config.ts` change is needed to use it.

## 2. Decision table

Use this table to decide whether an element needs a `data-testid`, and what pattern to use.

| Situation                                                                                                    | Needs `data-testid`?                     | Naming pattern                                                                                                                                                                                                                               |
| ------------------------------------------------------------------------------------------------------------ | ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Interactive element whose only label is translated (i18n) text                                               | Yes                                      | `<area>-<element>`                                                                                                                                                                                                                           |
| Interactive element already has a stable non-translated selector (DOM `id`, `formControlName`, `routerLink`) | No                                       | n/a — do not add a redundant testid                                                                                                                                                                                                          |
| Repeated list/table row or item                                                                              | Yes, one per rendered instance           | `<area>-<item-type>-row-<key>` (`<key>` = the item's natural stable id). If no natural id exists, fall back to `<area>-<item-type>-row-idx-<i>` — note that index-based ids are unstable across reorders/filters and are a last resort       |
| Interactive node inside a UI-library (PrimeNG) wrapper, with no other stable selector reaching it            | Yes                                      | Same pattern as the element's own category (static/repeated/shared); placed on the component's host tag unless it doesn't forward attributes to the real DOM node (see §3), in which case placed on the actual rendered node                 |
| Component reused across more than one screen/context                                                         | Yes (each usage must be distinguishable) | The component owns its own base testid for its interactive node(s); the call site passes a distinguishing prefix (e.g. a `testIdPrefix` `@Input()`) so usage A and usage B render different final values instead of colliding on a bare name |
| Element inside a dynamically shown/hidden overlay (e.g. a PrimeNG dialog)                                    | Yes, if otherwise qualifying             | The testid lives on the actual rendered node inside the overlay's content, so it exists in the DOM only while the overlay is mounted — no stale/duplicate node while closed                                                                  |

### Naming shape

- kebab-case, hyphen-joined segments, most-general-to-most-specific.
- Static one-off element: `<area>-<element>` — e.g. `sign-in-submit`, `settings-save-button`.
- Repeated list/table row: `<area>-<item-type>-row-<key>` — e.g. `holdings-row-<id>`.
- Shared component: the component's own base testid plus a call-site-supplied prefix — e.g.
  `<prefix-a>-delete-button` and `<prefix-b>-delete-button` for two usages of the same component,
  rather than both rendering a bare `delete-button`.

### Examples (derived from the spec's acceptance scenarios)

- A submit button whose only label is translated text → `<area>-submit` (e.g. `sign-in-submit`).
- A row in a holdings table → `holdings-row-<id>`, one per rendered row, keyed by the holding's id.
- A delete button reused across two different lists → the shared component renders
  `<testIdPrefix>-delete-button`; each call site passes its own `testIdPrefix` (e.g.
  `list-a-delete-button` / `list-b-delete-button`).

## 3. PrimeNG-wrapped interactive elements

Place `data-testid` on the PrimeNG component's host tag — most PrimeNG components (e.g.
`p-select`, `pButton`) forward arbitrary DOM attributes to their host element. The two existing
testids in this codebase (`language-switcher` on a `<p-select data-testid="...">`, `theme-toggle`
on a `<button pButton data-testid="...">`) already prove this works.

**Escape hatch**: where a PrimeNG component does _not_ forward attributes to the actual
interactive/focusable inner node — most commonly an overlay-based component rendering its content
into a portal via `appendTo="body"` (e.g. `p-confirmdialog`) — verify with a quick DOM inspection or
Playwright locator that the attribute lands on a node Playwright can actually query. If the plain
host attribute doesn't reach the right node, fall back to a `[attr.data-testid]` template binding,
PrimeNG's `pt`/passthrough attributes, or a `pTemplate`/`ng-template` override that puts the
attribute on the real rendered node.

## 4. Elements that already have a stable selector

An interactive element that already has a stable, non-translated selector — a DOM `id`, a
`formControlName`, or a `routerLink` target — does not need a `data-testid` on top. Adding one
would be redundant churn on an element that was never actually a Playwright pain point. Only add a
`data-testid` when no such stable selector already exists.

## 5. Grandfathered values

`language-switcher` and `theme-toggle` (both in
[app-header.component.html](../../apps/frontend/src/app/core/layout/app-header/app-header.component.html))
are confirmed conformant as-is: they're top-level, non-repeated, app-shell controls that are
unambiguous without an `<area>-` prefix, and are not reused in a conflicting context elsewhere. They
are kept exactly as named — no rename is required or expected.

## 6. Consumers of this convention

- **Template authors** (anyone writing or editing a template, human or agent): follow the decision
  table in §2 above when implementing or changing a UI element.
- **The `verify-ui` skill** (`.claude/skills/verify-ui/SKILL.md`): its selector-conventions
  guidance links here, and instructs that when an in-scope element is missing a testid, one should
  be added per this convention before falling back to translated-text matching.
- **`CLAUDE.md`**: instructs that implementing or changing a UI element meeting one of the "needs a
  testid" rows above includes adding the attribute as part of that same change, not a follow-up
  chore.

## 7. Non-goals

- This convention introduces no lint rule, ESLint plugin, or CI check to enforce it automatically —
  that would be a separate, larger decision that isn't required today.
- No committed Playwright/e2e spec file is added by this convention; verification is done via the
  ad-hoc `verify-ui` skill workflow.
