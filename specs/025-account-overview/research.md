# Research: Account Overview

No `NEEDS CLARIFICATION` markers remained in the Technical Context — the spec's Assumptions
section already resolved the open questions ahead of planning. This file records the decisions
made while translating those assumptions into a concrete implementation approach, each following
an existing pattern in this codebase rather than introducing a new one.

## 1. Category representation: fixed union vs. free string

**Decision**: `AccountCategory` is a TypeScript union of five literal string values —
`'GENERAL' | 'LEISURE' | 'SAVINGS' | 'CREDIT_CARD' | 'OTHER'` — stored as a SQLite `TEXT` column
with a `CHECK` constraint, mirroring `holdings.asset_type`. `'OTHER'` is the default and the
uncategorized bucket (FR-008/FR-009).

**Rationale**: spec.md's Assumptions explicitly frames the category set as "an extensible list of
labels rather than a fixed enum baked permanently into the domain" — but _extensible later_ does
not mean _unconstrained now_. A `CHECK`-constrained union gives the same compile-time exhaustiveness
checking `holdings.asset_type` already relies on (switch statements the compiler can verify are
complete), while staying just as easy to extend later (add a literal + a `CHECK` migration) as a
free-text column would be to start validating retroactively. A fully free-text category column
was rejected because the UI needs a closed set to build the fixed Select + grouping order the
mockup specifies (General → Leisure → Savings → Credit Card → Other) — a free column would need
that validation client-side anyway, with no server-side backstop.

**Alternatives considered**:

- Free-text category column, validated only in the frontend Select — rejected: no server-side
  guarantee, and grouping order becomes a client-side convention with nothing to fall back on if
  a future integration writes a category directly.
- A separate `account_categories` table (user-defined categories) — rejected as premature: nothing
  in spec.md asks for user-authored categories, and it would add a second CRUD surface + FK
  relationship for a need that isn't in scope. YAGNI (Principle V).

## 2. Named detail fields vs. fully generic key/value notes

**Decision**: Two fixed, optional `TEXT` columns for the two example fields spec.md names —
`card_usage` and `required_minimum` — plus one general `notes` TEXT column, all sitting alongside
the always-present `name`/`category`/`provider`/`website`/`purpose` columns. No generic key-value
store.

**Rationale**: spec.md's Assumptions section frames "bank card usage"/"required amount" as
"example free-text fields rather than a fixed, validated schema" — but the acceptance scenarios
and design.md's mockup only ever exercise these two named fields plus a general notes field
(design.md's modal: "card usage (text), required minimum (text), ... notes (textarea, for anything
not covered by the named fields)"). A fully generic key-value schema (arbitrary user-defined detail
labels) would satisfy the letter of "record whatever context matters" but is not what any
acceptance scenario, the mockup, or FR-010 actually requires, and it would add a second table, a
dynamic-schema UI, and ordering/uniqueness concerns for zero validated benefit — a YAGNI violation
of Principle V. The `notes` field is the pressure release valve: it already covers "whatever
context matters" for anything the two named fields don't.

**Alternatives considered**:

- Generic repeatable label/value pairs (a child table) — rejected per above; revisit only if a
  future spec explicitly asks for user-defined detail labels.
- A single JSON blob column for "details" — rejected: defeats `CHECK`/column-level validation, and
  SQLite JSON columns are explicitly discouraged by this codebase's Money/decimal-handling
  precedent of preferring explicit typed `TEXT` columns over opaque blobs.

## 3. Ownership / multi-user scoping

**Decision**: `accounts.owner_id` (nullable `TEXT`, same shape as `holdings.owner_id`), every
repository query scoped `WHERE owner_id = $N`, endpoint gated behind the existing
`@RequiresDomain('account-overview')` guard (already defined per `application-areas.ts`'s
`domainId: 'account-overview'`) and `@CurrentUser()`.

**Rationale**: Matches the established `holdings` pattern exactly (005-auth-sessions-isolation) —
a missing filter fails closed rather than leaking another user's row, and reuses infrastructure
(`CurrentUser` decorator, `RequiresDomain` guard) that already exists; no new auth concept is
needed for this feature.

**Alternatives considered**: None — this is a straight reuse of an established, working pattern;
inventing a different scoping mechanism for one more entity would violate Principle V's simplicity
mandate.

## 4. Delete confirmation

**Decision**: Frontend-only confirmation via PrimeNG `ConfirmDialog` before calling
`DELETE /account-overview/accounts/:id` (FR-005); the backend endpoint itself is a plain,
unconfirmed hard delete (no soft-delete/undo), matching `holdings.deleteById`'s "Hard delete — no
soft-delete/undo" precedent.

**Rationale**: design.md explicitly scopes "Exact delete-confirmation dialog copy/behavior" as a
"plan-time detail" left open by the mockup; FR-005 only requires _some_ confirmation step exists
before deletion is applied, which a client-side confirm dialog satisfies without adding
undo/soft-delete complexity nothing in spec.md asks for.

**Alternatives considered**: Soft-delete with an undo window — rejected, no requirement asks for
recoverability, and it would require a background retention/purge job with no spec-level need
(YAGNI).

## 5. Grouping vs. filtering (FR-009)

**Decision**: Always-grouped rendering (design.md's chosen variant) — the frontend groups the
already-fetched flat list client-side by category, in the fixed order General → Leisure → Savings
→ Credit Card → Other, omitting any category with zero accounts. No new backend endpoint or query
parameter for filtering.

**Rationale**: FR-009 accepts either grouping or filtering; design.md already chose grouping during
UX review and the mockup implements it that way. Client-side grouping over one already-fetched
list needs no backend support (the full list is always fetched — this is a low-volume reference
list per the Technical Context's Scale/Scope, so no server-side pagination/filtering is
justified).

**Alternatives considered**: A `?category=` query filter on `GET /account-overview/accounts` —
rejected as unnecessary given the dataset size and the mockup's always-grouped design; would add
an API surface with no corresponding UI need.
