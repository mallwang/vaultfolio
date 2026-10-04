# Data Model: Vermögensentwicklung (Net-Worth Tracking)

## Stored

### `wealth_snapshots`

| Column          | Type | Notes                                                                     |
| --------------- | ---- | ------------------------------------------------------------------------- |
| `id`            | TEXT | primary key (UUID)                                                        |
| `owner_id`      | TEXT | not null; every query is owner-scoped                                     |
| `snapshot_date` | TEXT | `YYYY-MM-DD`, not null, `GLOB` check; unique with `owner_id`              |
| `payload_enc`   | TEXT | `v1:` AES-256-GCM of the payload below, AAD `wealth_snapshots\|id\|owner` |
| `key_version`   | INT  | default 1                                                                 |
| `created_at`    | TEXT | ISO timestamp                                                             |
| `updated_at`    | TEXT | ISO timestamp                                                             |

Unique index `wealth_snapshots_owner_date_uidx (owner_id, snapshot_date)`.

Payload (strict whitelist; any other field is rejected):

```text
{
  note?: string,                       // ≤ 500
  entries: Entry[]                     // 1..200
}
Entry = {
  side: 'ASSET' | 'LIABILITY',
  class: { standard: StandardClassId } | { custom: string },   // custom 1..50 chars
  name: string,                        // 1..100
  amount: Money                        // decimal string, 2 fractional digits, ≥ 0
}
```

### `wealth_settings`

| Column        | Type | Notes                               |
| ------------- | ---- | ----------------------------------- |
| `owner_id`    | TEXT | primary key                         |
| `payload_enc` | TEXT | AAD `wealth_settings\|owner\|owner` |
| `key_version` | INT  | default 1                           |
| `updated_at`  | TEXT | ISO timestamp                       |

Payload: `{ classGroups: ClassGroupAssignment[] }` with
`ClassGroupAssignment = { side, class: ClassRef, group: BalanceGroup }`. At most one assignment per
`(side, class identity)`; the list is replaced as a whole on each upsert.

## Value types

- **Money**: canonical decimal string, exactly two fractional digits, `0.00 … 999999999999.99`.
- **StandardClassId**: assets `cash`, `bankBalances`, `preciousMetals`, `securities`, `crypto`,
  `realEstate`, `vehicles`, `collectibles`, `otherAsset`; liabilities `mortgage`, `loan`, `otherDebt`.
  A standard id is valid only on its own side.
- **ClassRef**: `{ standard } | { custom }`. **Class identity** (per side) is the standard id or the
  custom label normalized (trim, NFC, case-fold). The same text on both sides is two classes.
- **BalanceGroup**: `LIQUID | SECURITIES | TANGIBLE | OTHER_ASSET` (asset side) and
  `SHORT_TERM | LONG_TERM | OTHER_LIABILITY` (liability side); an assignment's group must belong to
  its side.

## Validation rules (mapped to the spec)

| Rule                                                                          | Spec           |
| ----------------------------------------------------------------------------- | -------------- |
| Date present, valid, not after today (+1 day tolerance), ≥ 1900-01-01         | FR-001, FR-017 |
| At least one entry; ≤ 200 entries                                             | FR-002, edge   |
| Every entry has name, side, class and amount; amount numeric and not negative | FR-002, FR-017 |
| One snapshot per owner and date (`409`, response carries the existing id)     | FR-005         |
| Unknown fields rejected; standard id only on its side; group only on its side | FR-019, FR-024 |
| Errors name the offending field only (`details[].field`), never the value     | FR-017, FR-019 |

## Derived (pure functions in `@vaultfolio/wealth`, never stored)

- **Snapshot totals**: `assets = Σ amount (ASSET)`, `liabilities = Σ amount (LIABILITY)`,
  `net = assets − liabilities` (may be negative).
- **Series** (ascending by date, within the chosen period): net worth, assets, liabilities, and the
  per-class amounts for assets (a class missing in a snapshot counts as `0.00`); liabilities are one
  series, optionally split by class in the table.
- **Change** per snapshot versus the previous one in the period: `Δ = net − prevNet`;
  `pct = Δ / prevNet` only when `prevNet > 0`, else `null` ("n/a"). The first snapshot in the
  period has no change.
- **Class sub-totals** per snapshot and side.
- **Period filter**: `1y`, `3y`, `all`, measured back from the latest snapshot's date; changes are
  computed within the filtered range.
- **Balance sheet** for one snapshot and the owner's group assignments: effective group of a class =
  assignment, else the standard default, else the side's "other" group; per group the sub-total and
  the entries; `equity = net`; `sumAssets = assets`; `sumPassiva = liabilities + equity`; the
  invariant `sumAssets == sumPassiva` holds by construction and is asserted in tests.
- **Copy template**: names, sides and classes of a snapshot with amounts blank, for FR-007.
- **Suggestions**: standard classes plus the distinct custom labels used in any snapshot, per side.

## State and lifecycle

Snapshots have no status. Create, update (including a date change, which re-checks uniqueness) and
delete are plain. Account deletion and `DELETE /wealth` remove all snapshot and settings rows of the
owner. Group assignments survive snapshot deletion (they belong to the class, not the snapshot) and
are removed only with the account or "delete all".
