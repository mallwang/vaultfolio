# Quickstart: Validating Data Export

Prerequisites: the app running locally (frontend + backend), logged in as the dedicated seeded
test user (see project memory — never `.env`/`environment.local.ts`), with at least a few Holdings
entries and Account Overview entries.

## US1 — Single-feature export (Holdings)

1. Open **Holdings**. Confirm the Export split-button appears immediately left of "Add holding",
   in the "info" severity color (see `design.md`).
2. Click the split-button's caret. Confirm the menu shows JSON, CSV, Excel, PDF, each with its own
   icon (per `contracts/export-lib.md`'s menu item list).
3. Choose **JSON** → a `holdings.json` file downloads. Open it: a JSON array, one object per
   holding, with every field visible in the Holdings table (`data-model.md`'s `columns`).
4. Choose **CSV** → `holdings.csv` downloads, opens in a spreadsheet app with one row per holding
   and a column per field; a holding whose "Management" value contains a comma is quoted correctly.
5. Choose **Excel** → `holdings.xlsx` downloads and opens with typed columns (numbers as numbers,
   dates as dates).
6. Choose **PDF** → `holdings.pdf` downloads, showing: title "Holdings", the infobox (matching
   `docs/user-guide.md` §4's description), the same distribution charts as the page, and the data
   table.
7. Switch the browser's language to German (or toggle any in-app language switch), repeat step 6 —
   confirm every label/header/infobox sentence is in German (FR-006, SC-003).
8. With a fresh account that has zero holdings, repeat steps 3–6 — confirm each format still
   downloads with valid structure (headers/columns, empty PDF table) and no error (FR-014).

## US2 — Same control on every feature

1. Open **Account Overview** — confirm the same Export control appears left of its "Add account"
   button; export each format and confirm the PDF infobox says "Account Overview" (not "Holdings")
   and the data matches `docs/user-guide.md` §5's fields.
2. Open **Retirement**, **Insurances**, **Haushaltsplaner**, **Wealth Development** in turn —
   confirm the Export control is present in each (per `research.md` §5, next to that page's
   placeholder-panel anchor) and every format downloads a validly structured, empty export.

## US3 — "Export my data"

1. Go to **Settings → Profile → Danger Zone**, click **Export my data (optional)** —
   `data-testid="profile-export-data"`.
2. A single `vaultfolio-data-export.zip` downloads. Extract it: confirm one subdirectory per
   feature (`holdings/`, `account-overview/`, `retirement/`, `insurances/`, `haushaltsplaner/`,
   `historic-wealth-development/`), each containing `<featureId>.json/.csv/.xlsx/.pdf`
   (`data-model.md`'s archive layout).
3. Confirm the `holdings/` and `account-overview/` files reflect the same real data verified in
   US1/US2, and the four placeholder features' files are valid-but-empty.

## Automated coverage (what `/speckit-tasks` should turn into test tasks)

- `libs/export` unit tests: each exporter (`json`/`csv`/`xlsx`/`pdf`) called with 0 rows and with
  several rows, asserting exact decimal-string round-tripping (Principle III) by parsing the real
  output bytes back (Principle IV) — not just checking the row objects passed in.
- `full-export-archive.ts` test: a registry with one throwing definition and several succeeding
  ones — assert the archive still contains every succeeding file and `failures` lists exactly the
  one that failed (FR-015).
- Export control component test: renders for a `featureId`, opens the menu, and — with
  `fetchData`/chart-capture mocked — triggers a download for each format.
- Per-domain registration test (one per domain, including the 4 placeholders): the registered
  `FeatureExportDefinition.columns` covers every field the domain's own list/detail view renders
  (SC-002), checked once per domain rather than centrally, so a future column added to a domain's
  UI without a matching export column addition fails that domain's own test.
