# Phase 1 Data Model: Distribution Chart Grouped by Asset Type

No persisted entity, database schema, or API DTO changes. The only shape affected is the
component-local, in-memory chart entry used to build the ECharts `series[0].data` — not part of
any stored or transmitted contract.

## Holdings Distribution Chart Entry (revised)

Defined in `apps/frontend/src/app/holdings/holdings-distribution/holdings-distribution.component.ts`,
replacing the current `HoldingsDistributionEntry` interface.

| Field       | Type        | Description                                                                                                                                                                                                                |
| ----------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `assetType` | `AssetType` | The sole grouping key (was previously combined with `name` for Precious metal/Crypto/Deposit money). Also drives slice color via `ASSET_TYPE_COLORS[assetType]`.                                                           |
| `value`     | `number`    | Sum (as `Decimal`, converted via `.toNumber()` at the presentation boundary) of `computeValue()` across all holdings of this `assetType` that have a computable value. Unchanged computation per holding (research.md #3). |

Removed fields (no longer needed since every entry is now a type-level aggregate):

- `name: string` — replaced by resolving `ASSET_TYPE_LABEL_KEYS[assetType]` directly at render
  time in `chartOption`'s `resolveName`/`data.map`, the same way ETF/Share are already labeled
  today.
- `isTranslationKey: boolean` — always `true` now, so the flag is redundant and can be dropped;
  `resolveName` simplifies to always calling `this.translate.transform(...)`.

## State transitions / validation

None — this is a derived, recomputed-on-every-`ngOnChanges` view model with no persisted state
transitions. Validation rules (which holdings are excluded, i.e. "no computable value") are
unchanged from current behavior (FR-004).

## Grouping algorithm (revised `recompute()`)

```text
for each holding in holdings:
  value = computeValue(holding)          # unchanged
  if value is null: excluded += 1; continue
  key = holding.assetType                 # was: isNamedGroup ? `${assetType}::${name}` : assetType
  totals[key] = (totals[key] ?? 0) + value
entries = [ { assetType: key, value: totals[key].toNumber() } for key in totals ]
```

Map keyed directly by `AssetType` (a 5-member union), so `totals` naturally never exceeds 5
entries (SC-001).
