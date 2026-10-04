# Quickstart: validating Vermögensentwicklung

Prerequisites: dependencies installed (`npm install`), a backend `.env` with a valid
`WEALTH_ENCRYPTION_KEY` (base64 of 32 random bytes, like the other domain keys; see `.env.example`),
a user with the domain `historic-wealth-development`. Do not read or print `.env` while testing.

## 1. Lib and backend tests

```bash
npx nx test wealth
npx nx test backend
npx nx e2e backend -- --testPathPattern wealth   # or the repo's e2e target for apps/backend
```

Expected: totals, net worth, changes (`pct` null for a zero or negative previous net worth), series
and the balance-sheet invariant `sumAssets == sumPassiva` pass; e2e covers create, update, delete,
duplicate date (`409` with `existingId`), owner isolation (another user's id gives `404`), whitelist
(`400`), 503 without a key and a changed key, and `DELETE /wealth`.

## 2. Frontend tests and lint

```bash
npx nx test frontend-domain-historic-wealth-development
npx nx run-many -t lint,test --projects=wealth,frontend-domain-historic-wealth-development,frontend,backend
```

## 3. Walk through the UI (use the `verify-ui` skill)

1. Open "Vermögen": empty state with "Ersten Stichtag erfassen".
2. Create a snapshot for today with five entries including a custom class ("Whisky"): the form asks
   once for its balance group; save. Reload: the snapshot persists.
3. Create three earlier snapshots with "Aus bestehendem Stichtag kopieren" and adjust amounts,
   out of chronological order: the table is sorted by date and changes are computed per neighbor.
4. Try the same date twice: the note offers to open the existing snapshot.
5. Add a mortgage on the liability side: chart shows it below the zero line with its pattern,
   net worth equals assets minus liabilities.
6. "Bilanz" tab: group sub-totals, equity as balancing figure, both sums equal; change the group of
   "Whisky" and check it moves in every snapshot's balance sheet.
7. Switch the period filter and toggle legend entries; mobile width: table scrolls inside its
   container, balance sheet stacks.
8. Dashboard: the tile shows latest net worth, change and trend; hide, reorder and reload.
9. Export dialog: the wealth PDF has KPIs, chart, class table, snapshot table and a balance sheet
   page; CSV, Excel and JSON contain the flat entry table and the totals table.
10. Delete all data in the danger zone: page, tile and export return to empty.

## 4. Operations

Without `WEALTH_ENCRYPTION_KEY` the domain shows the "unavailable" page and every route answers
`503`; the rest of the app is unaffected. Compose files and `.env.example` carry the new variable.
