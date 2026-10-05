# Quickstart: validating Versicherungen

Prerequisites: dependencies installed (`npm install`), a backend `.env` with a valid
`INSURANCES_ENCRYPTION_KEY` (base64 of 32 random bytes, like the other domain keys; see `.env.example`),
SMTP settings (or a local mail catcher) for the reminder check, a user with the domain `insurances` and,
for the linked lines, the domain `earnings` with imported synthetic payslips. Do not read or print `.env`
while testing.

## 1. Lib and backend tests

```bash
npx nx test insurances
npx nx test backend
npx nx e2e backend -- --testPathPattern insurances   # or the repo's e2e target for apps/backend
```

Expected: normalization and totals for every interval, timeline months, deadline tables, gap results and
whitelist pass; e2e covers create, update, delete, owner isolation (another user's id gives `404`),
whitelist (`400`), `503` without a key and with a changed key, `DELETE /insurances`, linked lines with and
without Earnings access, suppression of a linked line by a manual contract, and the reminder sweep
(one mail per deadline, none when disabled, none for inactive contracts, retry after a send failure).

## 2. Frontend tests and lint

```bash
npx nx test frontend-domain-insurances
npx nx run-many -t lint,test --projects=insurances,frontend-domain-insurances,frontend,backend,notifications
```

## 3. Walk through the UI (use the `verify-ui` skill)

1. Open "Versicherungen": empty state with "Ersten Vertrag erfassen"; with Earnings data the info note
   about the automatically taken-over statutory insurances appears.
2. Add a yearly household contract (138.00, payment month March): list shows 11.50 per month; the
   timeline shows the full amount in March.
3. Add a car contract with fixed cancellation date 30.11.: next deadline shows 30.11. and is highlighted
   inside the warning window.
4. Open "Verträge": statutory lines are green, read-only, tagged "aus Einkommen MM/YYYY"; toggle
   "Sozialversicherungen einrechnen" and check the totals change.
5. Open "Lückencheck": switch "Ich besitze eine Immobilie" on; building and natural-hazard insurance
   appear as missing; add a contract of that type and see it move to "Abgedeckt"; dismiss a suggestion and
   restore it.
6. Open "Erinnerungen": switch on, lead time 30; a contract with a deadline inside the window triggers one
   mail (check the mail catcher), none after switching off.
7. Check the mobile viewport and the dark theme, then export the data through the shared export dialog.

## 4. Privacy checks

- Database: `insurance_contracts.payload_enc` and `insurance_settings.payload_enc` hold only ciphertext.
- Logs during steps 2–6 contain no names, insurers, contract numbers or amounts.
- Another user cannot read or change the first user's contracts; deleting the account removes all rows.
