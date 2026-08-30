# Quickstart: Multilanguage Support

Validates User Stories 1–3 end-to-end. Assumes the app is already running per the repo's normal
dev setup (`nx serve backend`, `nx serve frontend`, or `docker-compose up`).

## Prerequisites

- Backend running with a writable `DATABASE_PATH` (migrations run automatically on boot —
  `DatabaseService.onModuleInit`).
- Frontend running and reachable in a browser.
- At least one user account to sign in with (bootstrap admin or any existing account).

## US1 — Switch the application display language (P1)

1. Open the app in a fresh browser profile (or clear `localStorage` for the site) and sign in.
2. Confirm the UI is in English (the default) and the header navbar shows a language switcher
   listing all `SUPPORTED_LANGUAGES` entries (data-model.md), with English marked active
   (FR-001/FR-002).
3. Select "Deutsch" from the switcher.
   - **Expect**: visible UI text updates to German immediately, no page reload/flash (FR-003,
     SC-001 — under 2 seconds).
4. Reload the page (or close and reopen the tab).
   - **Expect**: the app loads directly in German — no reselection needed (FR-004, SC-002).
5. Open the app in a different browser (or an incognito window / different device).
   - **Expect**: that session is independently in English (the untouched default) — the German
     choice from step 3 did not follow the account there (FR-004 acceptance scenario 4).
6. Navigate through the primary screens (dashboard, holdings, settings) while in German.
   - **Expect**: no raw translation keys or empty strings anywhere (FR-011); any string not yet
     translated silently falls back to its English text rather than breaking.

## US2 — Configure a separate email correspondence language (P2)

1. While signed in (any display language), open **Settings > Profile**.
2. Locate the "Email correspondence language" control — distinct from the header's display
   language switcher (FR-006, SC-003: reachable within 3 clicks from account settings).
3. Note it presents the same language list as the header switcher (FR-012), and — if never set —
   is pre-filled with the browser's current display language as a suggestion (research.md #3).
4. Select a language different from the current display language (e.g. display language = German,
   email language = English) and save.
5. Change the display language again (e.g. back to English) via the header switcher.
   - **Expect**: the saved email correspondence language from step 4 is unchanged — the two
     settings are independent (FR-009 acceptance scenario 4).
6. Verify persistence: reload the page, or sign in from a different browser/device.
   - **Expect**: the email correspondence language from step 4 is still set (`GET /api/profile`
     returns the same `emailLanguage`) — it's account-level, not device-local (FR-007, acceptance
     scenario 3).
7. As a check on the fallback path, use a second account that has never set an email language.
   - **Expect**: `GET /api/profile` returns `emailLanguage: null` for that account, meaning any
     future email-generation code must treat it as the application default (`en`) (FR-008).

## US3 — Content availability check (P3)

1. For each `SUPPORTED_LANGUAGES` entry, switch the display language and walk through: header
   navbar, sign-in, dashboard, holdings list/form, settings (profile + preferences), admin screens
   (if signed in as an admin).
2. **Expect**: no visible untranslated placeholder text, no raw `key.path`-shaped strings
   (FR-011 acceptance scenario 1), consistent with SC-005 (<1% of visible strings on primary
   screens missing a translation at launch).

## Automated coverage (what `nx test` should exercise)

- `apps/frontend/src/app/core/i18n/i18n.service.spec.ts` — resolution order, persistence,
  fallback-on-removed-language, mirroring `theme.service.spec.ts`'s structure.
- `apps/frontend/src/app/core/i18n/translate.pipe.spec.ts` — key lookup, missing-key fallback to
  the default dictionary.
- `apps/backend/src/profile/profile.service.spec.ts` / `profile.controller.spec.ts` — new
  `updateEmailLanguage` cases: valid code, `null` (clear), invalid code (400).
- `apps/backend/src/database/database.service.spec.ts` — new migration step is idempotent (safe to
  run against a DB that already has the `email_language` column).
