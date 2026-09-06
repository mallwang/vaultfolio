---
name: verify-ui
description: Verify a UI change in the real app with Playwright — app URLs, login helper, selector conventions, and a throw-away script template. Use whenever a frontend change (component, route, i18n string, style, PrimeNG usage) needs visual/functional confirmation, instead of relying on unit tests or code reading alone.
---

# Verify UI changes with Playwright

Vaultfolio has no committed Playwright e2e suite yet — `@nx/playwright` is wired up in
[nx.json](../../../nx.json) for a future `e2e` target, but for now UI verification means writing a
**throw-away script** against the running app, not adding permanent spec files. Don't create
`*.e2e-spec.ts` files or a `playwright.config.ts` unless the user explicitly asks for a real e2e
suite.

## 1. Get the app running

```bash
npm run dev   # nx run-many -t serve -p backend frontend
```

- Frontend: `http://localhost:4200`
- Backend: `http://localhost:3000` (proxied under `/api` from the frontend dev server)
- Wait for both `serve` targets to report ready before driving the browser — the frontend rebuild
  on first boot can take a few seconds.
- If something is already listening on 4200/3000, reuse it instead of starting a second copy.

If `.env` doesn't exist yet, copy it and set a password before first boot (see
[README.md](../../../README.md#authentication)):

```bash
cp .env.example .env   # then fill in BOOTSTRAP_ADMIN_PASSWORD
```

## 2. Read the login credentials from `.env`

Every route except `/health` requires a signed-in session. Read `BOOTSTRAP_ADMIN_EMAIL` /
`BOOTSTRAP_ADMIN_PASSWORD` out of the repo-root `.env` at script time — never hardcode or guess a
password:

```js
import { readFileSync } from 'node:fs';

function readEnv(key) {
  const line = readFileSync('.env', 'utf8')
    .split('\n')
    .find((l) => l.startsWith(`${key}=`));
  if (!line) throw new Error(`${key} not set in .env`);
  return line.slice(key.length + 1).trim();
}

const ADMIN_EMAIL = readEnv('BOOTSTRAP_ADMIN_EMAIL');
const ADMIN_PASSWORD = readEnv('BOOTSTRAP_ADMIN_PASSWORD');
```

These credentials are only seeded once, on first boot against an empty `./data` DB. If sign-in
fails with them, the DB was likely seeded earlier with different values — ask the user rather than
resetting `./data` yourself.

## 3. Sign in

The sign-in form ([sign-in.component.html](../../../apps/frontend/src/app/auth/sign-in/sign-in.component.html))
has stable, non-translated ids — prefer those over the (i18n'd) label text or button copy:

```js
await page.goto('http://localhost:4200/sign-in');
await page.locator('#email').fill(ADMIN_EMAIL);
await page.locator('#password').fill(ADMIN_PASSWORD);
await page.locator('form button[type="submit"]').click();
await page.waitForURL('**/app/dashboard');
```

## 4. Navigate and assert

Routes live under `/app/...` (declared in
[app.routes.ts](../../../apps/frontend/src/app/app.routes.ts)): `app/dashboard`, `app/holdings`,
`app/holdings/imports`, `app/retirement`, `app/insurances`, `app/haushaltsplaner`,
`app/historic-wealth-development`, `app/account-overview`, `app/settings` (with `profile` /
`preferences` sub-tabs), `app/settings/admin` (with `accounts` / `signups` / `invitations` /
`general` sub-tabs, admin-only).

Selector conventions, most to least preferred:

1. `[data-testid="..."]` where present (e.g. `language-switcher`, `theme-toggle` in the app
   header) — if an in-scope element is missing one, add it per
   [docs/frontend/testid-conventions.md](../../../docs/frontend/testid-conventions.md) rather than
   falling back to translated-text matching (item 4 below).
2. A stable DOM id/attribute (form fields, routerLink targets) — not translated.
3. PrimeNG role/structure locators (e.g. `page.getByRole('button', { name: /.../ })`,
   `.p-datatable-tbody tr`) — PrimeNG renders real ARIA roles, so `getByRole` usually works even
   through its component wrappers.
4. **Avoid** matching on translated label/placeholder text as the _only_ signal — strings come
   from i18n JSON and change per locale; if you must, combine it with a role or scope it under a
   stable container.

Take a screenshot as evidence whenever confirming a visual change:

```js
await page.screenshot({ path: '/tmp/.../verify.png', fullPage: true });
```

## 5. Script template

Start from [templates/verify-template.mjs](templates/verify-template.mjs) — copy it into your
scratchpad directory, edit the "EDIT ME" section, and run with:

```bash
node /path/to/scratchpad/verify.mjs
```

It launches headless Chromium, reads admin credentials from `.env`, signs in, and leaves you a
`page` to drive. Close the browser in a `finally` block so a failed assertion doesn't leak a
process.

## Notes

- This is a Node script using the raw `playwright` package (already a transitive dep via
  `@playwright/test`), not `nx run frontend:e2e` — there's no e2e project registered yet, so that
  target doesn't exist.
- Don't commit the script or its screenshots; they're verification scratch, not test coverage.
- If the change actually warrants a permanent e2e test, say so explicitly and ask before scaffolding
  one with `@nx/playwright` — that's a different, bigger decision than ad-hoc verification.
