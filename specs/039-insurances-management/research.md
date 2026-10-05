# Research: Versicherungen (Insurances Management)

All unknowns from the Technical Context are resolved below. Decisions follow the existing Earnings,
Retirement and Wealth domains wherever the situation is the same.

## R1 — Encryption and availability

**Decision**: Reuse the shared AES-256-GCM primitive (`apps/backend/src/shared/field-crypto.ts`) in an
`InsurancesCryptoService` with a dedicated `INSURANCES_ENCRYPTION_KEY`. One ciphertext per row, AAD
`<table>|<row id>|<owner_id>`, format `v1:<iv>:<tag>:<ciphertext>`. Missing or invalid key: the service
reports `available === false`, every insurances route answers `503 INSURANCES_UNAVAILABLE`, the
reminder sweep does nothing. At boot one stored row is decrypted to detect a changed key; an
authentication failure at runtime flips the service to unavailable.

**Rationale**: Same threat model as Retirement and Wealth; guard, helpers and e2e patterns transfer.

**Alternatives considered**: Reusing another domain's key (couples availability and rotation). Storing
only amounts encrypted (insurer, contract number, notes and profile flags are personal as well).

## R2 — Storage shape

**Decision**: Three tables.

- `insurance_contracts(id, owner_id, payload_enc, key_version, created_at, updated_at)`: the payload holds
  the whole contract.
- `insurance_settings(owner_id PRIMARY KEY, payload_enc, key_version, updated_at)`: profile, reminder
  preferences (global switch, lead time), dismissed gap suggestions, `includeSocial` toolbar preference.
- `insurance_reminder_log(owner_id, contract_id, deadline_date, sent_at, PRIMARY KEY(contract_id, deadline_date))`:
  plain; no names, no amounts.

**Rationale**: No plain business column is needed for queries (the list is small and fully decrypted per
request). The reminder log has to be queryable and must not require rewriting contracts. Account
deletion removes all three tables' rows (FR-001, Sensitive rule "follow the account lifecycle").

**Alternatives considered**: Plain `type` or `next_deadline` columns for server-side filtering (leaks which
insurances exist; unnecessary at this size). Reminder state in the payload (races with edits).

## R3 — Cancellation date derivation (FR-008)

**Decision**: A pure function `nextCancellationDate(contract, today)` in the lib. All dates are
`YYYY-MM-DD` strings handled as calendar dates (no time zones). Rules:

1. Status `CANCELLED`/`ENDED`, or an `endDate` in the past without renewal → no deadline.
2. **Fixed cancellation date** (`day`, `month`, e.g. 30.11. for car insurance): the next occurrence on or
   after `today` is the deadline (clamped for 29.02. in non-leap years); it must be on or after the
   first possible term end.
3. Otherwise a **term end** series: first term end = `endDate` if set, else `startDate + minimumTermMonths − 1 day`
   (default 12 months). With `autoRenew`, further term ends are every `renewalMonths` (default 12)
   after the first. The deadline of a term end is `termEnd − cancellationPeriod` (months with end-of-month
   clamping; weeks as 7 days). The result is the earliest deadline on or after `today`; if the current
   term's deadline has passed, the next term's is used.
4. No `autoRenew` and an `endDate`: the contract simply ends; the lib returns `{ kind: 'ENDS', date: endDate }`
   and no deadline (no reminder, no highlight).
5. No `endDate`, no `autoRenew`, no minimum term (open-ended): `{ kind: 'ANYTIME', period }`, "jederzeit
   kündbar mit Frist X"; no deadline and no reminder. This is the interpretation of the spec's
   "computed from the cancellation period only" edge case.

Output: `{ kind: 'DEADLINE' | 'ENDS' | 'ANYTIME' | 'NONE', date?, termEnd? }`.

**Rationale**: Covers German standard patterns (yearly term with 1–3 months' notice, fixed 30.11. date,
fixed multi-year terms) with a handful of inputs. No holiday or weekend adjustment (spec assumption).

**Alternatives considered**: Free-text deadlines (not computable, no reminders). Per-insurer rule
catalogs (maintenance burden).

## R4 — Premium normalization and timeline (FR-006, FR-007)

**Decision**: `decimal.js`. Payments per year: monthly 12, quarterly 4, half-yearly 2, yearly 1. Yearly
cost = premium × payments per year; monthly cost = yearly cost / 12. Totals are summed unrounded and
rounded once (`ROUND_HALF_UP`, 2 digits) so the sum of displayed lines can differ from the total by at
most a cent, which the tests pin down. Payment months: monthly every month; quarterly
`paymentMonth + {0,3,6,9}`; half-yearly `paymentMonth + {0,6}`; yearly `paymentMonth` (default January,
or the start month when the user gives none). The timeline for year Y counts a payment only if the
contract is active in that month (start ≤ month end, no end or end ≥ month start). The "per year"
KPI uses the current yearly equivalent of active contracts, not the timeline sum.

**Alternatives considered**: Rounding every line first (accumulating error against the exact yearly figure).

## R5 — Catalog and gap check (FR-004, FR-005, FR-014–FR-016)

**Decision**: A static catalog in the lib (not editable, not stored). Each type has `id`, `group`
(`PERSONS | LIABILITY | PROPERTY | MOBILITY | LEGAL | OTHER`), `classification`
(`ESSENTIAL | RECOMMENDED | SITUATIONAL | OPTIONAL`), optional `detailFields` (e.g. car: plate,
no-claims class), and optional `usuallyIncludedIn` (type ids whose standard conditions often cover it,
e.g. glass breakage in household contents) for the redundancy hint. The gap check does not look at types
but at **requirements**: each requirement has an `id`, `classification`, `appliesWhen(profile)` and a
list of `satisfiedBy` type ids. Examples: `LIABILITY` (always; private liability), `HEALTH` (always;
statutory or private health), `DISABILITY` (EMPLOYED or SELF_EMPLOYED), `HOUSEHOLD` (always), `BUILDING`
(`ownsProperty`), `NATURAL_HAZARD` (`ownsProperty`), `CAR` (`ownsCar`), `PET_LIABILITY` (`hasPets`),
`TRAVEL_HEALTH` (`travelsAbroad`), `LEGAL` (situational), `RISK_LIFE` (`hasChildren`). A contract
satisfies a requirement through its own type or through `alsoCovers` type ids (combination products,
FR-005 edge case). Output: `missing` (applicable, unsatisfied, not dismissed), `covered`,
`dismissed`, `redundant` (a type covered by another active contract's `alsoCovers`, or present together
with a type listed in its `usuallyIncludedIn`). Classification `OPTIONAL` is never reported as missing;
it appears only as redundant hint. The UI always shows the "general guidance, not advice" note.

**Rationale**: Requirements express "private OR statutory health" and combinations correctly and keep
the catalog a flat list.

**Alternatives considered**: A rule per catalog type (cannot express alternatives). A remote ruleset
(external service, not allowed).

## R6 — Linking social insurances to Earnings (FR-012, FR-013)

**Decision**: `InsurancesLinkedSocialService` calls the exported `EarningsService.records(ownerId)` only
when the caller is entitled to the `earnings` domain (admin or `domainScopes` contains it) and the
Earnings key is available. It takes the **latest period that has records**, sums over all employers'
records of that period the regular part of `health`, `care`, `pension` and `unemployment`
(`amounts.x − oneOff.x`), and returns up to four **linked lines** `{ kind, monthly, periodRef: 'YYYY-MM' }`.
Linked lines are computed per request, never stored. A line is **suppressed** if the user has an active
manual contract of the same social type (this is also how "switch to manual" works: the UI creates a
manual contract prefilled from the linked value, so no double counting is possible). Without Earnings
access or data, the response simply has no linked lines and the UI offers manual entry for the four
statutory types, which are ordinary catalog types (`STATUTORY_HEALTH`, `STATUTORY_CARE`,
`STATUTORY_PENSION`, `STATUTORY_UNEMPLOYMENT`) with interval `MONTHLY`.

**Rationale**: Earnings data is encrypted with its own key and owner-only; the backend is the only place
that may read it. Derivation per request keeps linked lines current after every import (Story 5
scenario 3) with zero synchronization.

**Alternatives considered**: Copying contributions into insurance storage (stale, duplicated sensitive
data). Frontend-to-frontend coupling (forbidden by Nx tags).

**Assumption flagged**: For voluntarily insured members the printed health/care figures may include the
employer subsidy part; the line shows the printed employee deduction as is and is labelled with its
source and period.

## R7 — Reminders (FR-010, FR-011)

**Decision**: `InsurancesReminderService` schedules `setInterval(sweep, 1 h).unref()` on module init (same
pattern as `RetentionSweepService`). A sweep: if the crypto service is unavailable, return; for each
`insurance_settings` row with `reminders.enabled`, load the owner, skip non-active accounts and owners
no longer entitled to `insurances`, decrypt that owner's contracts, and for each active contract with
`reminderEnabled` compute `nextCancellationDate`; if `kind = DEADLINE` and `deadline − leadDays ≤ today ≤ deadline`
and no row exists in `insurance_reminder_log(contract_id, deadline_date)`, render and send one email,
then insert the log row. If sending fails, no log row is written, so the next hourly sweep retries.
A deleted or deactivated contract is simply never found; its log rows are deleted with it. A new
term yields a new deadline date and therefore a new reminder (Story 4 scenario 3).

**Email**: new `NotificationType` `insurance-deadline-reminder` with `de`/`en` templates through the
existing renderer and the user's `emailLanguage`. View model: insurance type label, contract name,
deadline date, link to the Insurances area. No amounts, insurer or contract number (log and e-mail
hygiene; mail is not end-to-end protected).

**Defaults**: `enabled = false`, `leadDays = 30`, allowed 7–120. The warning window in the UI equals
`leadDays`.

**Alternatives considered**: `@nestjs/schedule` cron (new dependency). Plain `next_deadline` column to
avoid decrypting (see R2).

## R7a — Sweep concurrency

A single backend process runs the sweep. The `PRIMARY KEY(contract_id, deadline_date)` makes a duplicate
send impossible even if two sweeps overlap: the insert happens before sending is reported done, and an
insert conflict skips the mail. Order: insert log row first inside a transaction, send, delete the row
on send failure.

## R8 — API shape

**Decision**: One read route returns everything the page needs in one call (`GET /insurances`:
contracts, linked lines, settings); writes are contract CRUD, a settings `PUT`, and delete-all. The
frontend computes all derived views with `@vaultfolio/insurances`.

**Rationale**: At most 200 small contracts; one call keeps screens consistent and avoids chatty
endpoints. Same approach as Wealth.

## R9 — Frontend

**Decision**: Replace `InsurancesPlaceholderComponent`; keep the route, nav entry and dashboard domain
scope. Tabs and regions as in `design.md`. Charts via ECharts option builders in `charts/insurances-charts.ts`
(donut by group, bars per month). Export definition returns contracts as rows (type, name, insurer,
premium, interval, monthly, yearly, next cancellation, status), `isEnabled` true; linked lines are
included with a source column. Dashboard widget shows monthly cost and the next deadline. All strings in
`insurances.de.ts`/`insurances.en.ts`, covered by a translation completeness spec. New interactive
elements get `data-testid` per `docs/frontend/testid-conventions.md`.

## R10 — Constitution amendment

**Decision**: MINOR bump 3.11.0, first task: Product Scope bullet for Insurances (manual contract entry,
derived read-only social contribution lines from the user's own Earnings data, gap check, optional reminder
e-mails); Sensitive Personal Data names Insurances; the Retirement-only contract-number relaxation also
covers Insurances; the data-origin rule names the Earnings-derived lines as a read-only derivation, not
an import from an external system. Name, address, tax ID and bank details stay forbidden.
