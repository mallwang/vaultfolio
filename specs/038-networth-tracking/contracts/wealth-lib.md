# Contract: `@vaultfolio/wealth`

Framework-independent (no NestJS, Angular or DOM imports; Principle I). Used by the backend for
validation and by the frontend for every derivation, so screen, tile, balance sheet and PDF agree
(SC-005). Money is `decimal.js` internally and canonical two-digit decimal strings at the edges.

## Exports

```text
// model
type Side = 'ASSET' | 'LIABILITY'
type ClassRef = { standard: StandardClassId } | { custom: string }
type BalanceGroup = 'LIQUID' | 'SECURITIES' | 'TANGIBLE' | 'OTHER_ASSET'
                  | 'SHORT_TERM' | 'LONG_TERM' | 'OTHER_LIABILITY'
interface WealthEntry { side; class: ClassRef; name: string; amount: string }
interface WealthSnapshot { id; snapshotDate: string; note?: string; entries: WealthEntry[] }
interface ClassGroupAssignment { side; class: ClassRef; group: BalanceGroup }

// classes
STANDARD_CLASSES: Record<Side, readonly StandardClassId[]>
defaultGroupOf(standardId): BalanceGroup
groupsOf(side): readonly BalanceGroup[]
classKey(side, ref): string                  // identity: standard id or normalized custom label
matchStandardByLabel(side, label, translate): StandardClassId | null
suggestionsOf(side, snapshots): ClassRef[]   // standard + distinct custom labels in use

// validation
validateSnapshotInput(input, today): ValidationResult   // strict whitelist; errors name fields only
validateClassGroup(input): ValidationResult
normalizeMoney(text): string | null                      // "12.000,50" is the form's job; this takes "12000.5"

// summary
totalsOf(snapshot): { assets; liabilities; net }
filterPeriod(snapshots, '1y' | '3y' | 'all'): WealthSnapshot[]
seriesOf(snapshots): { dates; net[]; assets[]; liabilities[]; byClass: Record<classKey, string[]> }
changesOf(snapshots): { id; delta: string | null; pct: string | null }[]   // pct null when prev ≤ 0
latestOf(snapshots): { snapshot; totals; change } | null
copyTemplateOf(snapshot): WealthEntry[]                  // amounts blank ('')

// balance sheet
balanceSheetOf(snapshot, assignments): {
  assets: { group; subtotal; entries[] }[]
  liabilities: { group; subtotal; entries[] }[]
  equity: string
  sumAssets: string
  sumPassiva: string                                     // always equals sumAssets
}
effectiveGroup(side, ref, assignments): BalanceGroup

// testing entry point (test-only)
buildSnapshot(overrides?), buildEntry(overrides?)
```

## Behavior guarantees

- `balanceSheetOf` always satisfies `sumAssets == sumPassiva`; negative equity is allowed.
- `changesOf` returns `delta` for every snapshot except the first, and `pct` only for a previous net
  worth greater than zero.
- `seriesOf` treats a class absent in a snapshot as `0.00` for that date.
- `validateSnapshotInput` rejects unknown fields, negative or non-numeric amounts, a missing name,
  class or side, a standard id on the wrong side, no entries, more than 200 entries, a future date
  (today plus one day tolerated); it reports the offending field and a code, never the value.
- All functions are pure and deterministic; no function reads the clock except through the `today`
  argument.
