# Feature Specification: Distribution Chart Grouped by Asset Type

**Feature Branch**: `019-chart-distribution-by-type`

**Created**: 2026-09-04

**Status**: Draft

**Input**: User description: "I would like to change the distribution chart by value, so that only the types are shown (grouped and summarized). E.g. currently it shows 'Bitcoin' or 'Bargeld', but should show 'Crypto' / 'Deposit money'."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - See portfolio value split by asset type (Priority: P1)

As a portfolio owner, when I look at the distribution-by-value chart, I want every slice to represent one asset type (e.g. Crypto, Deposit money, Precious metal, ETF, Share) rather than an individual holding's own name, so I can see at a glance how my money is spread across categories of investment without needing to scan a list of individually named holdings.

**Why this priority**: This is the entire scope of the requested change and the only behavior the chart needs to deliver differently — without it, the feature is not implemented.

**Independent Test**: Add several holdings of different types, including multiple holdings of the same type with different names (e.g. two precious-metal holdings named "Gold" and "Silver", two crypto holdings named "Bitcoin" and "Ethereum", and a deposit-money holding named "Bargeld"). Open the distribution chart and verify it shows one slice per type present (e.g. "Precious metal", "Crypto", "Deposit money"), each slice's value being the sum of all holdings of that type, with no individual holding names appearing as labels.

**Acceptance Scenarios**:

1. **Given** a portfolio with two crypto holdings named "Bitcoin" and "Ethereum", **When** the distribution chart is displayed, **Then** it shows a single "Crypto" slice whose value equals the sum of both holdings' current values, not two separate slices labeled "Bitcoin" and "Ethereum".
2. **Given** a portfolio with a deposit-money holding named "Bargeld" and another named "Savings account", **When** the distribution chart is displayed, **Then** it shows a single "Deposit money" slice summing both, not slices labeled "Bargeld" and "Savings account".
3. **Given** a portfolio with holdings across all five asset types (ETF, Share, Precious metal, Crypto, Deposit money), **When** the distribution chart is displayed, **Then** it shows exactly one slice per type that has at least one holding with a computable value, labeled using the same localized type name used elsewhere in the app (e.g. "assetType.CRYPTO" translation), and each slice's value equals the sum of that type's holdings' values.
4. **Given** a portfolio with only one holding of a given type, **When** the distribution chart is displayed, **Then** that type's slice is still labeled with the type name (e.g. "Crypto"), not the individual holding's name.

### Edge Cases

- A type with no holdings, or whose holdings all have no computable value, produces no slice for that type (consistent with current behavior of excluding non-computable holdings from the chart).
- A portfolio with only one asset type present shows a single slice covering the full chart.
- The chart's slice color per type, and the excluded-holdings note/count, remain governed by existing behavior — only the grouping key and displayed label change.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The distribution-by-value chart MUST group every holding by its asset type only, regardless of asset type, replacing any grouping that currently keys on the holding's individual name.
- **FR-002**: Each chart slice MUST represent exactly one asset type and MUST display the type's localized display name (the same name used elsewhere in the app for that type) as its label, never an individual holding's own name.
- **FR-003**: Each type's slice value MUST equal the sum of the computed values of all holdings of that type that have a computable value, using the same per-type value computation currently used (e.g. current value for precious metal/deposit money, quantity × purchase price for others).
- **FR-004**: Holdings without a computable value MUST continue to be excluded from the chart's totals and reflected in the existing excluded-holdings indication, unchanged from current behavior.
- **FR-005**: A given asset type MUST appear as at most one slice in the chart; it MUST NOT be split into multiple slices even when its holdings have different individual names.
- **FR-006**: Slice coloring MUST continue to be determined by asset type, consistent with existing per-type coloring.
- **FR-007**: A type MUST be omitted from the chart entirely when it has no holdings with a computable value, consistent with existing empty-slice handling.

### Key Entities

- **Holding**: A user-entered investment position with an asset type (ETF, Share, Precious metal, Crypto, Deposit money), a user-assigned name, and a computable value. The chart no longer groups by this name.
- **Asset Type**: The fixed category a holding belongs to; now the sole grouping key and label source for the distribution-by-value chart.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: For any portfolio, the number of slices shown in the distribution-by-value chart never exceeds the number of distinct asset types in use (currently at most 5), regardless of how many individually named holdings exist.
- **SC-002**: A user with multiple differently-named holdings of the same asset type sees them combined into one correctly-summed slice on first view of the chart, with no separate slice per holding name.
- **SC-003**: Every slice label shown matches one of the app's existing localized asset-type names, in the user's selected language, with no raw holding name ever appearing as a chart label.

## Assumptions

- "Types" refers to the existing `AssetType` categories already used throughout the app (ETF, Share, Precious metal, Crypto, Deposit money) — no new categorization scheme is introduced.
- The value computed per holding, and the treatment of holdings that have no computable value, are unchanged by this feature; only the grouping/labeling changes from a mix of per-name (for Precious metal, Crypto, Deposit money) and per-type (for ETF, Share) to per-type for all asset types uniformly.
- The localized type display names already defined in the app's translation files (e.g. "Crypto"/"Krypto", "Deposit money"/"Giralgeld") are reused as-is; no new translation strings are required.
- This change applies only to the distribution-by-value chart; no other chart, list, or table that currently shows individual holding names is affected.
