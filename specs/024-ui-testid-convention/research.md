# Phase 0 Research: UI Test-ID Convention

## 1. Where does the convention document live?

**Decision**: `docs/frontend/testid-conventions.md` (new file, new `docs/frontend/` directory).

**Rationale**: FR-005 requires a location "both a future contributor and the `verify-ui` skill can
reference" — not buried in a single Nx project's own README. The repo currently has no top-level
`docs/` directory, but a convention that spans the app-shell (`apps/frontend`) and six independent
domain libraries (`libs/frontend/domain/*`) plus `libs/frontend/admin` shouldn't live inside any one
of them (that would misleadingly scope it to that project, and Nx boundary rules would make an
app-shell doc awkward to reference from a domain lib and vice versa). A root-level `docs/frontend/`
mirrors how `apps/frontend` and `libs/frontend/*` are already grouped by the `frontend` namespace
without being owned by any single Nx project. `.claude/skills/verify-ui/SKILL.md` already
cross-references files by relative path (e.g. `../../../apps/frontend/...`), so linking a root-level
doc from there is consistent with the skill's existing style.

**Alternatives considered**:

- Inside `.claude/skills/verify-ui/` itself — rejected: the convention is a frontend engineering
  standard applicable even without Playwright/agentic workflows in the picture; scoping it inside a
  Claude-specific skill folder would bury it from a plain human contributor reading the repo, and
  would violate FR-005's requirement that it not exist "only implicitly."
- Inside `apps/frontend/README.md` — rejected: the convention also governs `libs/frontend/domain/*`
  and `libs/frontend/admin` templates, not just the shell app; scoping the doc to one Nx project
  undersells its reach.
- A new root `CONTRIBUTING.md` section — rejected: too broad a file for one narrow convention;
  harder for the `verify-ui` skill to link to a specific anchor reliably over time.

## 2. Naming convention shape (static / repeated / shared)

**Decision**: kebab-case, hyphen-joined segments, most-general-to-most-specific, e.g.:

- Static one-off element: `<area>-<element>` — e.g. `sign-in-submit`, `settings-save-button`.
- Repeated list/table row: `<area>-<item-type>-row-<key>` where `<key>` is the item's natural
  stable id (e.g. a holding's UUID/DB id) — e.g. `holdings-row-<id>`. When no natural key exists
  (Edge Case), fall back to the rendered index: `holdings-row-idx-<i>`, with an explicit note in the
  convention doc that index-based ids are unstable across reorders/filters and are a last resort.
- Shared component reused across screens: the component keeps one internal-relative testid for its
  own interactive node(s), and the **call site** supplies a distinguishing prefix via an `@Input()`
  (e.g. `testIdPrefix`) so two usages render `<prefix-a>-delete-button` and `<prefix-b>-delete-button`
  rather than colliding on a bare `delete-button`. This mirrors Angular's existing pattern of a
  presentational component taking configuration inputs from its parent, so it needs no new
  architecture.

**Rationale**: Kebab-case matches existing testids (`language-switcher`, `theme-toggle`) and Angular/
CSS class-naming conventions already used in the codebase (BEM-ish `app-header__brand` etc. use
double-dash/underscore for element/modifier, but standalone testids in the wild — `language-switcher`
— are plain kebab-case), so the two pre-existing values already conform to "one word segments joined
by hyphens, area-then-role ordering isn't strictly followed but they're short, self-describing
top-level UI controls" — the convention explicitly grandfathers them (FR-004) as top-level,
non-repeated, non-shared-in-conflicting-contexts elements that need no prefix.

**Alternatives considered**:

- BEM-style double-underscore segments (`app-header__theme-toggle`) — rejected: more verbose than
  necessary for `getByTestId()` lookups (which don't need CSS-selector semantics), and would require
  renaming the two existing testids, which FR-004 says to avoid unless necessary.
- A single incrementing numeric id per element (`testid-001`) — rejected: not human-readable, defeats
  the purpose of a stable _and_ meaningful selector, fails SC-003 (a newcomer must be able to derive
  the name without a lookup table).

## 3. PrimeNG-wrapped interactive elements

**Decision**: `data-testid` is placed on the PrimeNG component's host tag (most PrimeNG components,
e.g. `p-select`, `pButton`, forward arbitrary DOM attributes to their host element, as already
proven by the existing `language-switcher` on `<p-select data-testid="...">` and `theme-toggle` on
`<button pButton data-testid="...">`). Where a PrimeNG component does _not_ forward attributes to the
actual interactive/focusable inner node (e.g. some overlay-based components render the interactive
element inside a portal attached to `appendTo="body"`), the convention requires verifying with a
quick DOM inspection (or Playwright locator) that the testid attribute lands on a node Playwright can
actually query — falling back to `[attr.data-testid]` template binding or a `pTemplate`/`ng-template`
override only if the plain host attribute doesn't reach the right node.

**Rationale**: The two existing testids already demonstrate the host-attribute approach works for
the two PrimeNG components in current use (`p-select`, `pButton`); no evidence in the codebase today
requires a more complex mechanism. Keeping the default simple (Principle V, YAGNI) and only
documenting the escape hatch for the rarer case (dynamically-mounted overlay content, called out in
spec Edge Cases) avoids over-engineering the common case.

**Alternatives considered**:

- Always using `[attr.data-testid]` binding instead of the plain HTML attribute — rejected as the
  default: unnecessary Angular binding overhead when a static string suffices (as the two existing
  testids already show); reserved only for cases needing a computed/dynamic value (e.g. per-row
  testids).

## 4. Elements that already have a stable selector (FR-003) — precedence rule

**Decision**: The convention explicitly ranks "already has a stable, non-translated selector" (DOM
`id`, `formControlName`, `routerLink` target) as sufficient on its own — no redundant `data-testid`
is added on top. This mirrors the `verify-ui` skill's own selector-preference list (already ranks
`data-testid` above "stable DOM id/attribute" only because a testid is _more specific_, not because
an existing id/formControlName/routerLink is insufficient) and keeps the retrofit (User Story 2)
scoped to genuinely-missing selectors rather than a full audit/rewrite (per spec Assumptions).

**Rationale**: Matches FR-003 and Acceptance Scenario 4 of User Story 2 verbatim; avoids unnecessary
template churn for elements that were never actually a Playwright pain point.

## 5. Updating `CLAUDE.md` and the `verify-ui` skill (FR-008/FR-009)

**Decision**: Add a short "UI element selectors" note to the frontend-relevant section of
`CLAUDE.md` (near the existing "Verifying UI changes" bullet) instructing that any new/changed
interactive element meeting the convention's criteria gets its `data-testid` added in the same
change, linking to `docs/frontend/testid-conventions.md`. Update `.claude/skills/verify-ui/SKILL.md`'s
existing "Selector conventions" list (item 1, `data-testid`) to link to that same doc and to say:
when a testid is missing on an in-scope element, add it per the convention rather than falling back
to translated-text matching (item 4 already discourages the latter; this closes the gap FR-009 flags
— today there's no explicit pointer to a _written_ convention to follow when adding a missing one).

**Rationale**: Both files already exist and already reference selector strategy — this is an
additive edit, not a new file, keeping the workflow change minimal per Principle V and directly
satisfying FR-008/FR-009 and User Story 3's acceptance scenarios.

**Alternatives considered**: A dedicated new CLAUDE.md section — rejected: the existing "Verifying UI
changes" section is already the natural home; a new top-level section would fragment closely related
guidance.

All "NEEDS CLARIFICATION" markers: none — the spec and its Assumptions section already resolve every
open question the Technical Context required.
