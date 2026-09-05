# Feature Specification: UI Test-ID Convention

**Feature Branch**: `023-ui-testid-convention`

**Created**: 2026-09-05

**Status**: Draft

**Input**: User description: "Define a data-testid naming pattern/convention for Angular templates in this app, retrofit existing UI templates to add stable data-testid attributes to elements that currently have no stable non-translated selector (buttons/tabs/menu items whose only label is i18n text, repeated list/table rows, PrimeNG-wrapped interactive elements), and update the agentic workflow (CLAUDE.md and the verify-ui skill) so that new or changed UI elements which could plausibly be under test get a data-testid added as part of normal implementation, not as a follow-up chore. Context: this follows from adopting Playwright-based UI verification (see .claude/skills/verify-ui/SKILL.md), where the selector-preference order already lists data-testid as the top choice but the convention/pattern itself isn't defined yet and most templates don't have one. Two existing testids in the codebase today: 'language-switcher' and 'theme-toggle' in the app header — the new pattern should account for these already existing."

## User Scenarios & Testing _(mandatory)_

<!--
  IMPORTANT: User stories should be PRIORITIZED as user journeys ordered by importance.
  Each user story/journey must be INDEPENDENTLY TESTABLE - meaning if you implement just ONE of them,
  you should still have a viable MVP (Minimum Viable Product) that delivers value.
-->

### User Story 1 - A documented naming convention exists (Priority: P1)

An engineer or coding agent working on any part of the frontend can look up one document and know,
without guessing, whether a given UI element needs a `data-testid`, and if so, what to name it —
including the tricky cases: an element repeated per row/item, and a shared component that appears
in more than one screen.

**Why this priority**: Without an agreed pattern, retrofitting existing templates (User Story 2)
and updating the agentic workflow (User Story 3) would each invent their own ad-hoc naming,
producing exactly the inconsistency this feature exists to prevent. The convention is the
prerequisite for everything else.

**Independent Test**: Can be fully tested by handing the written convention to someone unfamiliar
with it, giving them three example elements (a static button, a table row, a shared component used
twice), and confirming they land on the same testid names an author following the convention would
have picked — without needing any code change yet.

**Acceptance Scenarios**:

1. **Given** the convention document, **When** a reader looks up a static, one-off interactive
   element (e.g. a form's submit button) whose only label is translated text, **Then** they can
   derive a specific, unambiguous `data-testid` value for it.
2. **Given** the convention document, **When** a reader looks up a repeated element (e.g. a row in
   a list/table), **Then** the convention specifies how each instance gets a distinct, stable
   identifier rather than all rows sharing one value.
3. **Given** the convention document, **When** a reader looks up a component reused across more
   than one screen (e.g. the same button appearing in two different tabs), **Then** the convention
   specifies how to keep their testids distinguishable.
4. **Given** the two testids already in the codebase (`language-switcher`, `theme-toggle`),
   **When** they are checked against the new convention, **Then** they either already conform or
   the convention explicitly grandfathers them in without requiring a rename.

---

### User Story 2 - Existing UI gets stable selectors where they're missing (Priority: P2)

Someone verifying a UI change with Playwright (per the `verify-ui` workflow) can select any
interactive element that today has no stable, locale-independent way to find it — because its only
label is translated text, it's one of several identical repeated rows, or it's an interactive
element buried inside a UI-library wrapper — using a `data-testid` instead of brittle text/CSS
matching.

**Why this priority**: This is the payoff of User Story 1 — it's what actually unblocks reliable
Playwright verification, but it depends on the convention existing first, and it's a larger,
noisier change than defining the convention itself.

**Independent Test**: Can be fully tested by picking a handful of previously "hard to select"
elements across the app (a translated-label button, a row in a repeated list, a PrimeNG-wrapped
control), confirming each now carries a `data-testid` per the convention, and confirming a
Playwright script can locate each one by testid alone with no other change to app behavior.

**Acceptance Scenarios**:

1. **Given** an interactive element whose only distinguishing label is i18n text, **When** its
   template is updated, **Then** it carries a `data-testid` and remains selectable the same way
   regardless of the active locale.
2. **Given** a list or table that renders one row per data item, **When** its template is updated,
   **Then** each rendered row carries its own distinct `data-testid` (not one value shared by every
   row).
3. **Given** an interactive element wrapped by a PrimeNG component with no other stable selector,
   **When** its template is updated, **Then** the actual interactive node carries a `data-testid`
   reachable by Playwright.
4. **Given** an element that already has a stable, non-translated selector (a DOM `id`, a
   `formControlName`, a `routerLink` target), **When** the retrofit pass reviews it, **Then** no
   redundant `data-testid` is added.
5. **Given** any template updated by this retrofit, **When** its existing unit tests and visual
   behavior are checked, **Then** nothing changes except the presence of the new attribute.

---

### User Story 3 - New UI work keeps the convention current going forward (Priority: P3)

An engineer or coding agent implementing a new UI element, or changing an existing one, that meets
the convention's "needs a testid" criteria adds the correct `data-testid` as part of that same
change — without a human having to ask for it or file a separate follow-up task.

**Why this priority**: This is what makes User Stories 1 and 2 durable instead of one-time cleanup;
it's ordered last because it's a workflow/guidance change with no effect until the convention
(User Story 1) exists, but on its own it's the lowest-effort of the three.

**Independent Test**: Can be fully tested by walking through a sample UI change (e.g. adding a new
button whose only label is translated text) against the updated guidance and confirming it calls
out, at the point of implementation, that a `data-testid` is expected — without needing the full
retrofit (User Story 2) to be complete.

**Acceptance Scenarios**:

1. **Given** the updated project guidance, **When** an agent implements a new interactive element
   that meets the "needs a testid" criteria, **Then** the guidance instructs adding the testid as
   part of that change.
2. **Given** the updated `verify-ui` skill, **When** an agent writes a Playwright verification
   script against a newly changed element, **Then** the skill points it to the convention document
   before it falls back to translated-text matching.

---

### Edge Cases

- What happens when a repeated element (list/table row) has no natural unique key from the data
  (e.g. no id, only an index)? The convention must define a fallback (e.g. position-based suffix)
  and note its limitation (unstable if rows reorder).
- What happens when the same shared component is used in visually similar but functionally
  distinct contexts (e.g. a "delete" button appearing in both a settings list and an admin list)?
  The convention must ensure the resulting testids don't collide.
- What happens to an element that already has a stable non-translated selector — does it also get
  a `data-testid`, or is one considered redundant? (See Assumptions — default is "no redundant
  testid.")
- What happens to the two pre-existing testids (`language-switcher`, `theme-toggle`) if they
  don't cleanly fit the new pattern? The convention must state explicitly whether they're
  grandfathered as-is or renamed to conform.
- What happens when an element is dynamically shown/hidden (e.g. inside a PrimeNG overlay/dialog
  that mounts on open)? The testid must remain on the actual rendered node so it's only queryable
  while present, with no stale/duplicate testid left in the closed state.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The convention MUST define a `data-testid` naming pattern covering, at minimum:
  static one-off elements, repeated/list elements (one distinct value per rendered instance), and
  components reused across more than one screen (distinguishable per usage context).
- **FR-002**: The convention MUST define which categories of elements require a `data-testid` —
  at minimum: interactive elements whose only distinguishing label is translated (i18n) text,
  repeated list/table rows or items, and interactive elements wrapped by a UI library component
  with no other stable selector reaching the actual interactive node.
- **FR-003**: The convention MUST define which elements do _not_ need a `data-testid` — at
  minimum, any element that already exposes a stable, non-translated selector (a DOM `id`, a
  `formControlName`, a `routerLink` target, or similar).
- **FR-004**: The convention MUST explicitly state how the two pre-existing testids
  (`language-switcher`, `theme-toggle`) relate to it — either confirmed as already conformant, or
  grandfathered without a rename.
- **FR-005**: The convention MUST be written down in a location that both a future contributor and
  the `verify-ui` skill can reference, rather than existing only implicitly in retrofitted
  examples.
- **FR-006**: Existing UI templates MUST be reviewed against the categories in FR-002, and each
  in-scope element found MUST be updated to carry a `data-testid` per the convention.
- **FR-007**: The retrofit (FR-006) MUST NOT change any element's rendered behavior, styling, or
  existing automated test results — the attribute addition must be behaviorally inert.
- **FR-008**: The project's agentic guidance (CLAUDE.md and the `verify-ui` skill) MUST be updated
  to instruct that a new or changed UI element meeting the FR-002 criteria gets its `data-testid`
  added as part of implementing that change, not deferred to a separate task.
- **FR-009**: The updated `verify-ui` skill's selector-preference guidance MUST point authors of
  verification scripts to the convention document when deciding whether/how to add a missing
  testid, instead of falling back to translated-text matching.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: 100% of elements matching the FR-002 categories across the app's existing templates
  carry a `data-testid` once the retrofit is complete.
- **SC-002**: A Playwright script that locates an in-scope element purely by `data-testid` behaves
  identically regardless of which supported locale the UI is rendered in.
- **SC-003**: A person unfamiliar with the convention can correctly name the `data-testid` for each
  of the three example element types in User Story 1's acceptance scenarios (static, repeated,
  shared) using only the written convention, without asking a maintainer.
- **SC-004**: Across a sample of UI changes made after this feature ships, at least 95% that touch
  an FR-002-qualifying element include the matching `data-testid` in the same change, with no
  separate follow-up task needed to add it.

## Assumptions

- Scope is limited to the Angular frontend app (`apps/frontend`); no backend changes are involved.
- The attribute name is `data-testid` (Playwright's default `getByTestId()` lookup), not a custom
  attribute name — no Playwright test-id configuration change is needed.
- The retrofit (User Story 2) only adds testids to elements matching the FR-002 categories; it is
  not a full audit or rewrite of every template in the app.
- This feature does not itself add any new committed Playwright/e2e specs — it prepares selectors
  for the existing throwaway verification workflow (see the `verify-ui` skill) and for any future
  formal e2e suite, which remain separate decisions.
- The two pre-existing testids (`language-switcher`, `theme-toggle`) are kept working as-is; the
  convention is written to accommodate them rather than forcing an immediate rename.
- The currently supported languages (`SUPPORTED_LANGUAGES`) are the relevant locale set for
  locale-independence checks; the convention does not need special-casing for languages not yet
  supported.
