# Quickstart: Validating the UI Test-ID Convention

This guide proves the feature end-to-end once implemented (tasks.md drives the actual build). It
does not duplicate the decision table — see
[contracts/testid-convention-contract.md](./contracts/testid-convention-contract.md) and
[data-model.md](./data-model.md) for that detail.

## Prerequisites

- Working tree on branch `024-ui-testid-convention` (or later, once merged).
- `docs/frontend/testid-conventions.md` exists (User Story 1 deliverable).
- App running locally per the `verify-ui` skill:
  ```bash
  npm run dev   # nx run-many -t serve -p backend frontend
  ```

## Scenario A — User Story 1: convention is usable without a maintainer (SC-003)

1. Hand a reader (or a fresh agent context) only `docs/frontend/testid-conventions.md`.
2. Give them three prompts, one per example type from the spec's Acceptance Scenarios:
   - "A submit button whose only label is translated text — what's its testid?"
   - "A row in a holdings table — how does each row get a distinct testid?"
   - "A delete button reused in two different lists — how do you keep them distinguishable?"
3. **Expected**: each answer matches the pattern in the contract's decision table (§2) without the
   reader asking a maintainer.
4. Check `language-switcher` / `theme-toggle` against the doc.
   **Expected**: the doc explicitly states they're grandfathered/conformant (FR-004) — no ambiguity.

## Scenario B — User Story 2: retrofit produces locale-independent selectors (SC-002)

1. Pick one retrofitted element from each FR-002 category (a translated-label button, a repeated
   table row, a PrimeNG-wrapped control) — the actual list of retrofitted elements is tracked in
   tasks.md.
2. Run the app with the default locale, and note the element's `data-testid` via the Playwright
   inspector or a throw-away script (see the `verify-ui` skill for the login-and-navigate steps):
   ```js
   await expect(page.getByTestId('<value>')).toBeVisible();
   ```
3. Switch the active language (via `language-switcher`) to a second supported locale and repeat step
   2 against the **same** `getByTestId('<value>')` call.
   **Expected**: the locator finds the same element in both locales — no locale-specific text was
   part of the lookup.
4. Confirm no rendered output changed (screenshot diff or visual check) and that the component's
   existing unit tests still pass:
   ```bash
   npx nx test <affected-project>
   ```
   **Expected**: green, unchanged assertions (FR-007 — behaviorally inert).

## Scenario C — User Story 3: new work is guided at the point of implementation (SC-004)

1. Read the updated `CLAUDE.md` frontend guidance and `.claude/skills/verify-ui/SKILL.md`.
2. Walk through a hypothetical: "add a new button whose only label is translated text."
   **Expected**: the guidance explicitly calls for a `data-testid` on that button as part of the same
   change, and links to `docs/frontend/testid-conventions.md`.
3. Walk through: "write a Playwright verification script for a changed element with no testid yet."
   **Expected**: the `verify-ui` skill points to the convention doc to add one, before suggesting
   translated-text matching as a last resort.

## Out of scope for this quickstart

- No committed Playwright/e2e spec is created or run as part of this validation (see spec
  Assumptions) — Scenario B uses the existing throw-away verification workflow.
- No lint/CI enforcement check exists to run (see contract §5 Non-goals).
