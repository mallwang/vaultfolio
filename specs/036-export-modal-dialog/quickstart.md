# Quickstart: validating the Export Modal Dialog

## Prerequisites

`npm install`; app running as described in the `verify-ui` skill; test user from the project memory (not `.env`).

## Automated

```bash
npx nx run-many -t lint,test -p @vaultfolio/export @vaultfolio/frontend-shared-ui @vaultfolio/frontend-domain-earnings @vaultfolio/frontend-domain-holdings
```

Expect: file-name helper specs, dialog/control specs (open, four cards, per-card export, busy, error, disabled), Earnings override spec (4 tables, `.zip`).

## Manual / Playwright (throw-away script, `verify-ui` skill)

1. Open Holdings → "Daten exportieren" link visible, no split button.
2. Click → dialog with PDF, Excel, CSV, JSON; CSV shows `….csv`.
3. Click "Als Excel exportieren" → download named as shown; dialog stays open; click CSV → second download.
4. Earnings → CSV card shows `….zip` and four CSV files; downloaded file name matches.
5. Retirement (disabled) → link disabled, tooltip, no dialog.
6. 400 px viewport → one column, no horizontal scroll. Dark theme → readable.
7. Switch language to English → texts and file names follow after reopening.
