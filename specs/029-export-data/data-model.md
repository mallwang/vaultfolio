# Phase 1 Data Model: Data Export

This feature introduces no new persisted/database entities (see `plan.md` Technical Context —
exports are generated on demand and never stored). The entities below are the shared, in-memory
TypeScript contract that `libs/export` operates on, and that each domain library supplies.

## FeatureExportDefinition

The contract a domain library registers with the shared `FeatureExportRegistry` (spec's "Feature
Export Definition" key entity). One instance per feature (Holdings, Account Overview, Retirement,
Insurances, Haushaltsplaner, Historic Wealth Development).

| Field             | Type                                           | Notes                                                                                                                                                                                                                                                                                           |
| ----------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `featureId`       | `string` (fixed ASCII slug, e.g. `'holdings'`) | Used for filenames (`holdings.json`) and archive subdirectory names (FR-011). Never derived from user data (spec's Edge Cases).                                                                                                                                                                 |
| `titleKey`        | translation key                                | Resolves to the feature's display name (e.g. "Holdings"), used as the PDF title and archive folder label source.                                                                                                                                                                                |
| `infoboxKey`      | translation key                                | Resolves to the PDF infobox body text (FR-005); sourced from `docs/user-guide.md` where a section already exists (Holdings §4, Account Overview §5), freshly written in the same style otherwise.                                                                                               |
| `columns`         | `ExportColumn[]`                               | Ordered list of exportable fields — see below. Must cover every field visible in that feature's on-screen table/detail view (FR-007, SC-002).                                                                                                                                                   |
| `fetchData`       | `() => Promise<ExportRow[]>`                   | Calls the feature's existing API (e.g. the same `HttpClient` call its list page already makes) to get the current user's full dataset. Resolves to `[]` for a feature with no data yet (FR-014) — including all 4 placeholder domains today (see `research.md` §5).                             |
| `getChartOptions` | `(() => EChartsOption[]) \| null`              | Optional. When present, one `EChartsOption` per chart to render for the PDF (FR-004) — reuses the same option object(s) the feature's on-screen chart component(s) compute. `null` for features with no charts (all 4 placeholders today, and any feature that never gets distribution charts). |

## ExportColumn

One exportable field within a `FeatureExportDefinition`.

| Field      | Type                                        | Notes                                                                                                                                                                                                                                                  |
| ---------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `key`      | `string`                                    | Property name read off each `ExportRow`.                                                                                                                                                                                                               |
| `labelKey` | translation key                             | Resolves to the human-readable column header/JSON-adjacent label in the user's language (FR-006).                                                                                                                                                      |
| `format`   | `'text' \| 'number' \| 'decimal' \| 'date'` | Drives CSV/XLSX cell typing (FR-003a) and PDF table cell rendering; `'decimal'` values must round-trip through the same `decimal.js` string representation already used end-to-end (Principle III — exact-value requirement), never a native `number`. |

## ExportRow

`Record<string, string | number | null>` — one row per record (e.g. one Holding, one Account
Overview entry). Decimal-typed values are carried as their canonical decimal string (never a
native float), consistent with the constitution's money/decimal-handling rule; the exporters
convert that string into each format's native numeric type (XLSX cell number, PDF table text) only
at the final serialization step, never earlier.

## FeatureExportRegistry

An ordered collection of registered `FeatureExportDefinition`s, added to at bootstrap by each
domain library (one `register(definition)` call per domain, analogous to the existing
Dashboard/Settings per-domain contribution registries the constitution already mandates). Consumed
by:

- The export control (single-feature export): looks up its own feature's definition by
  `featureId`.
- The full "Export my data" flow (Account Settings): iterates every registered definition to build
  the ZIP (FR-010–FR-012) — this is the mechanism that makes a newly-registered feature appear in
  future full exports automatically (FR-012, SC-004), with no changes to the full-export code
  itself.

## Export Archive (full export)

Not a persisted entity — the in-memory/`jszip` structure built by `full-export-archive.ts`:

```text
vaultfolio-data-export.zip
├── holdings/
│   ├── holdings.json
│   ├── holdings.csv
│   ├── holdings.xlsx
│   └── holdings.pdf
├── account-overview/
│   ├── account-overview.json
│   ├── account-overview.csv
│   ├── account-overview.xlsx
│   └── account-overview.pdf
├── retirement/            # empty-but-valid today (no data provider yet — see research.md §5)
│   └── ...
├── insurances/
│   └── ...
├── haushaltsplaner/
│   └── ...
└── historic-wealth-development/
    └── ...
```

Per FR-015, if one `featureId`/format combination's generation throws, the archive assembly
catches that single failure, omits only that file, records `{ featureId, format }` in a
`failures: { featureId: string; format: ExportFormat }[]` result alongside the ZIP blob, and the
UI surfaces that list to the user (e.g. "Retirement PDF could not be generated — retry from the
Retirement page") rather than failing the whole download.

## State / Validation Notes

- No state transitions — an export request is a single synchronous-from-the-user's-perspective
  action (fetch → generate → download), not a tracked/resumable entity (spec Assumptions: "no
  scheduled/recurring export or export history is in scope").
- `featureId` and format values are drawn from fixed enums controlled by the codebase, never from
  user input, so filename/path traversal in the archive is structurally not possible (spec's Edge
  Cases).
