# Design: Account Overview

**Mockup**: [mockup.html](./mockup.html) (durable local copy) — originally reviewed at
https://claude.ai/code/artifact/aa21dfde-7c89-47f4-b797-f21aaf2b7063 (this remote link may go
stale; the local copy is the source of truth).

## Summary

The Account Overview page is a **static reference directory** — a page inside the existing
authenticated app shell (sidebar + header) that lists every account the user has recorded, so they
can remind themselves what each one is, who it's with, and any context they've noted about it
(e.g. how a card is used, or a minimum balance to keep in it). It deliberately carries **no money**
— no balances, no totals, no subtotals. That's a hard pivot from the first mockup draft, made
during review (see "Revision history" below).

Categorization (General / Leisure / Savings / Credit Card / Other) is optional structure layered
on top of a flat list, not a requirement — a user who doesn't think in those terms sees one plain
list with no empty category clutter (spec.md US3, FR-008/FR-009).

## Layout per region

### App shell (reused, not new)

Sidebar (left, 232px desktop / horizontal scrollable top bar on mobile) + header (crumb "Vaultfolio"

- page title "Account Overview" + user meta/theme-toggle/sign-out), unchanged from the existing
  `app-shell`/`app-sidebar`/`app-header` components (`apps/frontend/src/app/core/layout/`). The
  "Account Overview" nav item already exists in `application-areas.ts` and currently routes to
  `AccountOverviewPlaceholderComponent` (022-add-domain-placeholders) — this feature replaces that
  placeholder with the real page. No new nav entries needed.

### Content region — grouped view (default, FR-001/FR-002/FR-009)

- A toolbar row: an eyebrow line stating the account/category count, a one-line description, and a
  primary "Add account" button (top-right).
- Below it, one **category group** per in-use category (in the order General → Leisure → Savings →
  Credit Card → Other), each a bordered card with:
  - A header: category name (+ a short subtitle for the built-in categories, e.g. "General · fixed
    income & costs") and an account count.
  - One **account row** per account in that group:
    - A small initials avatar (first letters of the account name).
    - Name + provider, the provider rendered as a link (external-link icon) when a website is
      recorded (FR-002).
    - A one-line purpose description.
    - A wrapping row of "detail chips" — label: value pairs for whatever free-text details the
      user recorded (card usage, required minimum, or anything else — FR-010) — only chips with a
      value are shown.
    - Edit and delete icon buttons, right-aligned.
- A category with no accounts is not rendered at all (no empty group headers — Edge Cases).

### Content region — flat view (all-uncategorized, FR-008/FR-009, Edge Cases)

Same toolbar and account-row shape, but instead of multiple category groups there is exactly one
group, headed "All accounts", holding every account. This is not a separate mode the user picks —
it is what the grouped view naturally reduces to once no account uses a specific category, so no
additional UI state is needed beyond "render only the categories that have accounts in them."

### Empty state (FR-011)

Centered card in the content region: an icon, "No accounts yet", one line of guidance, and a
primary "Add your first account" button. Replaces the whole content region when the account count
is zero.

### Add / edit account (FR-003/FR-004/FR-006)

A modal dialog (centered, dimmed backdrop) reused for both add and edit, with fields in this order:
name (required — shows a red-bordered field + inline error text when submitted empty), category
(select, defaults to "Other"), provider/institution (text), website (URL text), purpose (text),
card usage (text), required minimum (text), notes (textarea, for anything not covered by the named
fields). Cancel/Save actions in the footer.

## Requirement traceability

| Spec item                   | Region                                                                                             |
| --------------------------- | -------------------------------------------------------------------------------------------------- |
| FR-001, FR-002              | Grouped/flat content region, account row                                                           |
| FR-003, FR-004, FR-006      | Add/edit modal                                                                                     |
| FR-005                      | Delete icon button (confirmation dialog itself is out of scope for this mockup — plan-time detail) |
| FR-007, FR-008, FR-009      | Category select in the modal; grouped vs. flat content region                                      |
| FR-010                      | Detail chips (account row) + the modal's card-usage/required-minimum/notes fields                  |
| FR-011                      | Empty state                                                                                        |
| FR-012 (no balances/totals) | Absence of any monetary figure anywhere in the mockup                                              |

## Out of scope for this mockup

- Exact delete-confirmation dialog copy/behavior (FR-005) — only the row-level delete affordance is
  shown.
- Exact category-filter interaction mechanics (always-grouped vs. a dropdown/tabs filter) — FR-009
  only requires grouping-or-filtering; the mockup shows the always-grouped variant.
- Whether "card usage" / "required minimum" become dedicated schema fields or generic label/value
  pairs at the data layer — spec.md's Assumptions section leaves this as a plan-time decision;
  the mockup shows them as named fields for concreteness.

## Revision history

1. **First draft**: modeled as a small finance dashboard — balances per account, per-category
   subtotals, and a grand total, plus a positive/negative balance edge case for credit cards.
2. **User feedback**: this is meant to be a reference-only directory — no expenses/incomes/
   balances at all. Wanted a provider homepage link, a purpose description, and a couple of
   free-text fields like "bank card usage" and "required amount". Also flagged the sidebar
   rendering at the top of the page instead of on the left.
3. **Fixes applied**: removed every balance/total/subtotal element; added provider link, purpose,
   and detail-chip fields; fixed `.app-shell`'s missing `display: grid` (it inherited `display:
block` by default, stacking the sidebar above the content instead of beside it).
4. **Follow-up bugs** (caught in review, both from state-visibility CSS overrides that weren't
   scoped to their owning `data-screen` value): the empty and add-account screens rendered blank
   because an inline `style="display:none"` outranked the toggle rule; then, after removing that,
   the add-account modal appeared on every screen because its show-rule wasn't scoped to
   `[data-screen='add']` specifically. Both fixed by scoping every top-level (non-nested)
   conditional block's CSS override to its exact `data-screen` value, matching the pattern already
   used for the base per-screen visibility rules.

## Visual language note

Approximates PrimeNG's default "Aura" preset (light) — Vaultfolio has no theme file wired up as of
this feature (see `specs/010-theme-switch/design.md`'s identical note). Exact design tokens will be
finalized once real PrimeNG theming is in place; this mockup is a close approximation, not the
final pixel values.
