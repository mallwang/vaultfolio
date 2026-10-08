# Quickstart: Validating the Notification Center

Prerequisites: dependencies installed (`npm ci`), backend and frontend runnable (see the `verify-ui` skill for URLs, test account and Playwright template).

## Automated checks

```bash
npx nx test @vaultfolio/frontend-hints
npx nx test frontend
npx nx test @vaultfolio/frontend-domain-insurances
npx nx test @vaultfolio/frontend-domain-earnings
npx nx lint frontend @vaultfolio/frontend-hints @vaultfolio/frontend-domain-insurances @vaultfolio/frontend-domain-earnings
npx nx build frontend
```

Expected: all pass; lint reports no module-boundary violation (domain libs depend only on `scope:shared`).

## Scenario 1: badge and list (US1)

1. Sign in as the test account with Insurances containing two overlapping contracts and Earnings with a data-check finding.
2. Header shows the bell with a badge equal to the number of findings.
3. Open the panel: hints are grouped by source (Insurances, Einkommen), warnings first; each link leads to its target page and closes the panel.
4. Remove one of the overlapping contracts, navigate once: the Insurances hint and one badge count disappear.

## Scenario 2: hide and restore (US2)

1. Hide one hint: badge decreases, the hint appears under "Ausgeblendet (1)".
2. Reload: still hidden. Restore: back in the active list, badge increases.
3. Hide all hints: badge shows a gray dot instead of a number; the hidden section stays reachable.
4. Hide an Earnings finding, then change its content (import further payslips so the finding differs): it becomes active again and counts.
5. Sign in as a different user in the same browser: nothing is hidden for them.

## Scenario 3: gating and isolation (US3)

1. Put Insurances into maintenance (admin Domains tab): its hints disappear after the next page load and it is not requested.
2. Simulate a failing data-check request: Earnings hints are absent, Insurances hints remain, the shell works.

## Scenario 4: mobile (design)

At 400 px width the panel opens as a modal with a backdrop; it closes via the close button, the backdrop, or Escape.

## Storage inspection

`localStorage['vaultfolio.hints-hidden.<userId>']` contains only ids, source ids and signature hashes; no names, amounts or translated text.
