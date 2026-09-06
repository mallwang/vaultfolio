# Quickstart: Account Overview

Validates the feature end-to-end once implementation is complete (tasks.md), covering US1–US3's
independent tests from spec.md.

## Prerequisites

- Local stack running per the repo's standard dev setup (`docker-compose up`, or
  `npm exec nx serve backend` + `npm exec nx serve frontend` — see repo root `README.md` for
  exact commands; this feature adds no new setup step).
- A logged-in user with the `account-overview` domain scope (bootstrap admin has every domain by
  default — see `DatabaseService.ensureBootstrapAdmin`).

## Scenario 1 — Empty state (FR-011)

1. Sign in as a user with zero accounts recorded.
2. Open the Account Overview page (sidebar nav item, already registered per
   `application-areas.ts`).
3. **Expect**: an empty-state card ("No accounts yet") with a primary "Add your first account"
   button — no category groups rendered.

## Scenario 2 — Add, view, edit, delete an account (US1 + US2)

1. From the empty state (or the toolbar's "Add account" button), open the add-account modal.
2. Submit with only a `name` filled in (all other fields blank).
3. **Expect**: the account appears immediately in the overview, under the "Other" category group
   (default), with no provider link/purpose/detail chips shown (SC-002, SC-003 — no manual
   refresh needed).
4. Submit the modal again with `name` blank.
5. **Expect**: submission is rejected with an inline error explaining the name is required
   (FR-006) — no account is created.
6. Add a second account with every field filled in: name, category = "Savings", provider,
   website, purpose, card usage, required minimum, notes.
7. **Expect**: the overview shows the provider name as a link to the recorded website, the purpose
   text, and detail chips for card usage/required minimum (FR-002).
8. Edit the first account: change its category to "Credit Card" and add a purpose.
9. **Expect**: it moves out of the "Other" group into a new "Credit Card" group, showing the new
   purpose (FR-004).
10. Delete the second account, confirming the delete prompt.
11. **Expect**: it disappears from the overview immediately (FR-005/SC-003).

## Scenario 3 — Grouping and the uncategorized fallback (US3)

1. Ensure at least one account exists in each of "General", "Leisure", "Savings", "Credit Card",
   and leave at least one uncategorized ("Other").
2. **Expect**: the overview renders one group per category that has ≥1 account, in the fixed order
   General → Leisure → Savings → Credit Card → Other, each with an account count in its header
   (FR-009, SC-005); no empty category headers appear for categories with zero accounts.
3. Edit every categorized account back to "Other" (or delete them), leaving only uncategorized
   accounts.
4. **Expect**: the overview collapses to a single flat list (no visible "Other" grouping clutter,
   Edge Cases) while every account is still fully visible and editable (SC-004).

## Automated coverage (see tasks.md for concrete test files)

- `libs/domain/accounts`: unit tests for `account-validation.ts` (required name, category
  whitelist, optional-field trimming/null-normalization) — mirrors `holding-validation.spec.ts`.
- `apps/backend/src/account-overview/*.spec.ts`: controller + repository unit tests for each
  endpoint's request/response contract (contracts/account-overview-api.md).
- `apps/backend/src/tests/account-overview.e2e-spec.ts`: full HTTP round-trip against a real
  temp SQLite file — create → list → update → delete — mirrors `holdings-persistence.e2e-spec.ts`
  (Principle IV).
- `libs/frontend/domain/account-overview`: component tests for the overview page's
  grouping/empty-state logic and the add/edit form's required-name validation.
