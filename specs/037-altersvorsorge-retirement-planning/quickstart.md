# Quickstart: validating Altersvorsorge end to end

Prerequisites: dependencies installed (`npm ci`), a Base64 32-byte key for the new domain, a seeded
admin (see `docs/development.md`).

```bash
# one-time: generate a key for local development
openssl rand -base64 32          # put the output into RETIREMENT_ENCRYPTION_KEY (see .env.example)
```

## 1. Libraries and backend

```bash
npm exec nx -- run-many -t test -p document-text retirement earnings frontend-document-reader
npm exec nx -- run backend:test
npm exec nx -- run backend:e2e   # includes retirement.e2e-spec.ts and the OpenAPI completeness spec
```

Expected: parsers extract the invented figures from the synthetic documents; a misread figure or a
missing label is rejected as a whole; summary totals equal the sum of the entered figures; owner
isolation holds (another user's id → 404, admin sees nothing foreign); `PUT` on an imported record →
409; unknown field → 400; without the key every route → 503 while Holdings still works.

## 2. Run the app and walk the primary flows

```bash
npm exec nx -- run-many -t serve -p backend frontend
```

Use the `verify-ui` skill (test-user credentials per its notes) and check against
[design.md](design.md):

1. **Empty state** — open "Altersvorsorge": three dashed pillar cards, upload and manual buttons;
   dashboard tile shows its empty state.
2. **Statutory via upload** — upload a (synthetic or your own, locally kept) Renteninformation: for a
   scan the consent card appears; after consent the review table shows the figures and the
   "Plausibilitätsprüfung bestanden" badge; confirm → statutory tab shows an "Importiert" card with
   no edit action, only "Durch neues Dokument ersetzen" and "Löschen".
3. **Private statement** — upload a Riester statement: review shows guaranteed values and 0/3/6/9 %
   scenarios (3 % preselected); enter the monthly contribution; save → card shows "manuell ergänzt"
   next to the contribution, and the contribution stays editable.
4. **Occupational capital account** — upload an employer account statement: saved as capital
   ("Kapital, keine Monatsrente"); statement older than 12 months shows "Veraltet".
5. **Unrecognised / inconsistent document** — upload an unrelated PDF or one with a changed figure:
   "Dokument nicht erkannt", nothing saved, "Manuell eingeben" works.
6. **Manual entry** — add a Direktversicherung and a private pension insurance; editing works; entering
   expected < guaranteed shows the inline error.
7. **Overview and tile** — totals match the cards (guaranteed vs. expected, savings, pension start);
   outdated/incomplete notes appear; the dashboard tile shows the same four figures and links to the
   page.
8. **Info tab** — three cards, links open in a new tab.
9. **Export** — "Daten exportieren" offers PDF/Excel/CSV/JSON and each contains the records.
10. **Delete** — delete one entry (totals update); delete all data (empty state returns).

## 3. Key handling

Start the backend without `RETIREMENT_ENCRYPTION_KEY`: the Retirement area shows the "unavailable"
state (503), the dashboard tile degrades gracefully, other areas keep working. Restore the key: data
reappears. Start with a different valid key over existing data: the domain stays unavailable (boot
self-check).

## 4. Privacy checks

- Browser network log during an import contains only the final `POST /retirement/records` (no file,
  no extracted text); the payload contains only whitelisted fields.
- Server logs contain no amounts or numbers.
- `sqlite3` on the database file shows `payload_enc` ciphertext, not figures or numbers.

## 5. Gates before merge

```bash
npm exec nx -- run-many -t lint test build
npm run format:check
```

Plus the coverage audit (`/speckit-coverage`), the local Sonar scan, and the OpenAPI drift check.
