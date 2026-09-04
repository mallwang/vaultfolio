# Phase 0 Research: Distribution Chart Grouped by Asset Type

No `NEEDS CLARIFICATION` markers remain in the Technical Context — the spec's Assumptions section
already resolves the only open questions (grouping key, label source, value computation, scope).
This document records the resulting decisions for traceability.

## 1. Grouping key

- **Decision**: Group every holding by `holding.assetType` only. Drop the existing
  `isNamedGroup` branch in `HoldingsDistributionComponent.recompute()` that currently keys
  Precious metal/Crypto/Deposit money by `${assetType}::${name}`.
- **Rationale**: FR-001/FR-005 require at most one slice per type regardless of individual
  holding names; the current per-name branch is exactly what produces "Bitcoin"/"Bargeld" slices
  today.
- **Alternatives considered**: Keep per-name grouping for some types and add a toggle — rejected,
  out of scope per spec Assumptions ("only the grouping/labeling changes... to per-type for all
  asset types uniformly"); no toggle was requested.

## 2. Slice label source

- **Decision**: Always resolve the slice name via `ASSET_TYPE_LABEL_KEYS[assetType]` (existing
  `assetType.*` i18n keys already used for ETF/Share today), rendered through the existing
  `TranslatePipe`/`resolveName` mechanism. The `isTranslationKey` flag on the entry becomes
  always-true and can be dropped from the entry shape.
- **Rationale**: FR-002/SC-003 require the same localized type name used elsewhere in the app,
  with no raw holding name as a label. `ASSET_TYPE_LABEL_KEYS` (in
  `apps/frontend/src/app/holdings/asset-type-fields.ts`) already covers all five types — no new
  translation strings needed (per spec Assumptions).
- **Alternatives considered**: None — this is the existing, already-proven mechanism for the two
  types (ETF, Share) that are already grouped by type today.

## 3. Value computation per holding

- **Decision**: No change. Keep `HoldingsDistributionComponent.computeValue()` exactly as-is
  (`currentValue` for Precious metal/Deposit money, `quantity × purchasePrice` otherwise), and
  keep excluding holdings with no computable value from totals (incrementing `excludedCount`).
- **Rationale**: FR-003/FR-004 explicitly require this to stay unchanged; only grouping/labeling
  changes.
- **Alternatives considered**: N/A — out of scope by spec Assumptions.

## 4. Slice coloring

- **Decision**: No change — continue keying `ASSET_TYPE_COLORS[entry.assetType]` off the entry's
  (now-always-type-level) `assetType` field.
- **Rationale**: FR-006 requires coloring to remain per-type; since every entry is now already a
  single type's aggregate, `entry.assetType` continues to work unmodified.

## 5. External interface impact

- **Decision**: No `contracts/` artifact is produced for this feature.
- **Rationale**: The feature changes only client-side aggregation/labeling of data already
  returned by the existing, unchanged `GET /holdings` endpoint. No new or modified API, CLI, or
  file-format contract is introduced (Constitution Principle II is unaffected — the API contract
  itself does not change).

## 6. Test strategy

- **Decision**: Extend `holdings-distribution.component.spec.ts` to assert: (a) multiple
  differently-named holdings of the same type collapse into one slice with the exact summed
  Decimal value; (b) the slice's `name` in the resulting `chartOption` resolves to the type's
  `assetType.*` translation, never a holding's `name`; (c) existing excluded-holdings-count
  behavior is unaffected.
- **Rationale**: Constitution Principle III requires exact-value assertions for monetary sums;
  the existing spec file already exercises `chartOption` and `excludedCount` via the component's
  public/protected surface, so extension (not a new test harness) is sufficient.
