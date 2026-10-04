# Research: Vermögensentwicklung (Net-Worth Tracking)

All unknowns from the Technical Context are resolved below. Decisions follow the existing Earnings
and Retirement domains wherever the situation is the same.

## R1 — Encryption and availability

**Decision**: Reuse the shared AES-256-GCM primitive (`apps/backend/src/shared/field-crypto.ts`) in a
`WealthCryptoService` with a dedicated `WEALTH_ENCRYPTION_KEY`. One ciphertext per row, AAD
`<table>|<row id>|<owner_id>`, format `v1:<iv>:<tag>:<ciphertext>`. Missing or invalid key: the
service reports `available === false`, every wealth route answers `503 WEALTH_UNAVAILABLE`; at boot
one stored row is decrypted to detect a changed key; an authentication failure at runtime flips the
service to unavailable.

**Rationale**: Identical threat model to Retirement (FR-019). Fail-closed behavior and the e2e helpers
already exist and transfer directly.

**Alternatives considered**: Reusing `RETIREMENT_ENCRYPTION_KEY` (couples two domains' availability
and rotation). Plain storage with only amounts encrypted (entry names like "Whisky-Sammlung" are
personal data and the spec requires names to be protected).

## R2 — Storage shape

**Decision**: Two tables.

- `wealth_snapshots(id, owner_id, snapshot_date, payload_enc, key_version, created_at, updated_at)`,
  unique index on `(owner_id, snapshot_date)`. The payload holds the note and all entries.
- `wealth_settings(owner_id PRIMARY KEY, payload_enc, key_version, updated_at)` for class-to-group
  assignments.

The snapshot date is the only plain business column: it is needed for ordering and for the
one-snapshot-per-date rule, and a date alone is not monetary. Totals are never stored.

**Rationale**: A snapshot is read and written as a whole (a form submits all positions), so one
encrypted document per snapshot is simpler than an entries table and keeps every name and amount in
ciphertext. Total derivations in the lib cannot drift from stored data.

**Alternatives considered**: An `entries` table with encrypted columns (more rows, partial updates
nobody needs, harder to keep totals consistent). Storing the group per entry (violates FR-026). A
plain `class` column for suggestions (leaks user-written labels).

## R3 — API shape and where totals are computed

**Decision**: A deliberately dumb REST surface under `/wealth`: list all snapshots (ascending by
date), get/create/update/delete a snapshot, read settings, upsert one class-group assignment,
delete all. The server validates and stores; it computes no totals. All derivations live in
`@vaultfolio/wealth` and run in the browser (and in the PDF/export definition, which also runs in the
browser).

**Rationale**: Overview, tile, balance sheet and PDF share one code path (SC-005). The list is small
(≤ 600 rows), so returning all decrypted snapshots in one request is cheaper than a derived-data
endpoint and lets the period filter and class toggles work without round trips.

**Alternatives considered**: A server-side `/summary` like Retirement (needed there for a nontrivial
aggregate; here the aggregate is a sum and re-fetching per filter change would be wasteful).

## R4 — Classes: standard ids versus free text

**Decision**: An entry's class is either `{ standard: <id> }` (ids: assets `cash`, `bankBalances`,
`preciousMetals`, `securities`, `crypto`, `realEstate`, `vehicles`, `collectibles`, `otherAsset`;
liabilities `mortgage`, `loan`, `otherDebt`) or `{ custom: <label> }`. The UI translates standard
ids; custom labels are shown as typed. When the user types a label that equals (case-insensitively)
a translated standard name of that side, the form stores the standard id. Class identity within a
side is the standard id or the normalized custom label (trimmed, NFC, case-folded); a class name
used on both sides is two classes (spec edge case).

**Rationale**: Storing the German label would leave English-language users with German classes and
would split "Krypto" and "Crypto" into two series. Custom labels stay free (FR-003, SC-004).

**Alternatives considered**: Storing the label only (language lock-in and split series). A user-managed
class list entity (extra CRUD surface; the spec says classes exist only through their entries).

## R5 — Balance groups

**Decision**: Fixed groups. Assets: `LIQUID`, `SECURITIES`, `TANGIBLE`, `OTHER_ASSET`. Liabilities:
`SHORT_TERM`, `LONG_TERM`, `OTHER_LIABILITY`. Defaults for standard classes: `cash`, `bankBalances`
→ `LIQUID`; `securities`, `crypto` → `SECURITIES`; `preciousMetals`, `realEstate`, `vehicles`,
`collectibles` → `TANGIBLE`; `otherAsset` → `OTHER_ASSET`; `mortgage` → `LONG_TERM`; `loan` →
`LONG_TERM`; `otherDebt` → `SHORT_TERM`. A custom class has no group until the user assigns one
(prompted once in the form); until then its entries appear under the side's "other" group. User
assignments, including overrides of standard classes, are stored in `wealth_settings` and apply to
all snapshots.

**Rationale**: Fixed groups keep the balance sheet comparable and avoid inventing a taxonomy editor;
FR-024 and FR-025 specify exactly this. "Other" as the fallback guarantees both sides always balance.

**Alternatives considered**: User-defined groups (taxonomy editor, unclear semantics for ratios).
Deriving groups from names (unreliable).

## R6 — Money, percent and the "n/a" rule

**Decision**: Amounts are canonical decimal strings with exactly two fractional digits (`^\d{1,12}\.\d{2}$`
after normalization, input `12000`, `12.000,50` handled by the form, not the API). Sums use
`decimal.js`. The net worth is assets minus liabilities and may be negative. The percentage change of
the net worth versus the previous snapshot is `(net − prev) / prev`, shown only when `prev > 0`;
otherwise it is `null` and rendered "n/a" (spec edge case). Absolute change is always defined.

**Rationale**: Same money rule as the rest of the app. A percentage against zero or a negative base
is misleading, so it is withheld.

**Alternatives considered**: Percent against `|prev|` (a growth from −100 to −50 would read "+50 %",
which hides that the person is still in debt).

## R7 — Charts (screen and PDF)

**Decision**: ECharts, as Earnings and Holdings do. One option builder, `charts/wealth-charts.ts`,
returns a stacked bar chart (assets stacked up by class, liabilities as one negative-stack series
with a decal pattern and a distinct color) plus a line series for the net worth. The same builder
feeds `getChartOptions()` for the PDF raster; the PDF capture size is wide (≈ 1000×330) because the
section renderer draws the first chart at full page width. Legend toggles use the native ECharts
legend selection. A text summary of the series is exposed next to the chart for assistive
technology (FR-020).

**Rationale**: No new dependency, one code path for screen and PDF, and the decal keeps liabilities
distinguishable without color (print, color vision).

**Alternatives considered**: Hand-written SVG (the mockup does it for speed, but axes, tooltips,
legend selection and PDF rasterization would all be rebuilt). A different charting library (new
dependency).

## R8 — PDF report

**Decision**: Use the section-based PDF (`getPdfSections`), landscape: a `kpis` section (net worth,
change in the period, assets, liabilities), then the chart via `getChartOptions`, then `table`
sections for the class breakdown of the latest snapshot in the period and for the snapshot table,
and a final `table` section for the balance sheet (four columns: Aktiva, amount, Passiva, amount;
group header rows as `emphasis: 'total'` rows, last row the sums). The balance table starts on a new
page.

**Deviation from the mockup**: the section renderer draws the chart full width and the class table
below it, not side by side. Accepted: no change to `@vaultfolio/export` for a layout nicety.

**Alternatives considered**: Extending the export lib with a two-column layout (scope creep). Using
`chartSideTable` (it takes allocation rows with percentages and cannot show the change column).

## R9 — Other export formats

**Decision**: CSV, Excel and JSON use `getTables()` with one flat table, one row per entry
(snapshot date, side, class, name, amount, balance group) plus a snapshot-totals table (date,
assets, liabilities, net worth). The "Export my data" bundle iterates every registered feature; a
403 (not entitled) or 503 (no key) yields empty output instead of failing, as in Retirement.

**Rationale**: The flat form is what a user wants for round-tripping into a spreadsheet, and it
matches how Earnings and Retirement export.

**Alternatives considered**: A wide pivot (one column per class) — changes with every new class.

## R10 — Dashboard tile

**Decision**: Register one `DashboardWidgetContribution` for domain `historic-wealth-development`.
The tile reads the same list endpoint and uses the lib for the latest net worth and change. The
sparkline is an inline SVG polyline, not an ECharts instance, so the dashboard does not load the
chart library for a 44-pixel line. Ordering and visibility reuse the existing dashboard layout
store (no change).

**Alternatives considered**: ECharts sparkline (loads the library on every dashboard view).

## R11 — Domain, route and navigation naming

**Decision**: Keep the registered domain id and route `historic-wealth-development`, and the area
entry already present in `application-areas.ts`; change only its label via translations to
"Vermögen" / "Wealth" (the mockup's nav label). Routes: `/historic-wealth-development` (area with
tabs Entwicklung and Bilanz), `/historic-wealth-development/new`, `/historic-wealth-development/:id/edit`.
Entitlement uses the existing domain scope; the backend uses `@RequiresDomain('historic-wealth-development')`.

**Alternatives considered**: Renaming the domain id (breaks stored entitlements and tests).

## R12 — Limits and validation

**Decision**: At most 600 snapshots per user (50 years monthly), 200 entries per snapshot, name ≤ 100
characters, custom class ≤ 50, note ≤ 500, amount ≤ 999 999 999 999.99, date from 1900-01-01 to
today (server date plus one day, to tolerate time zones). At least one entry per snapshot (spec
edge case); a duplicate date returns `409 WEALTH_SNAPSHOT_DATE_EXISTS` with the existing snapshot id
so the UI can offer to open it. Unknown fields: `400 WEALTH_UNKNOWN_FIELD`. Negative amounts:
`400 WEALTH_VALIDATION`.

**Rationale**: Bounds keep a single list response small and make the decrypt-all strategy safe.

## R13 — Account lifecycle

**Decision**: On account deletion the user repository also deletes the user's rows from
`wealth_snapshots` and `wealth_settings` (FR-021), as it does for Retirement. `DELETE /wealth`
deletes both for the caller on request (danger zone in the area).
