# Research: Multilanguage Support

## #1: Runtime i18n mechanism — hand-rolled service vs. third-party library

**Decision**: A small hand-rolled `I18nService` (signal-based, `apps/frontend/src/app/core/i18n/`)
plus a `translate` pipe reading from TypeScript-object dictionaries bundled directly into the
frontend build (`translations/en.ts`, `translations/de.ts`). No `@ngx-translate/core`, no
`@jsverse/transloco`, no `@angular/localize`.

**Rationale**:

- The spec's needs are simple lookup + fallback (FR-003, FR-011) — no pluralization rules, ICU
  message formatting, or lazy per-route dictionary loading are required by any acceptance
  scenario.
- This codebase already has a direct precedent for exactly this shape of per-browser UI-chrome
  preference: `010-theme-switch`'s `ThemeService` (signal, `localStorage`, synchronous resolution
  at construction to avoid a flash of the wrong value). `I18nService` reuses that shape.
- Principle V (YAGNI) requires justifying new dependencies over a simpler alternative; a lookup
  table with fallback is a few dozen lines and doesn't need a library's runtime, DI setup, or
  bundle weight.
- `@angular/localize` is a build-time (compile-per-locale) i18n mechanism, incompatible with
  FR-003's requirement to switch language at runtime without a page reload/rebuild.
- Bundling dictionaries as plain TS objects (rather than fetching JSON at runtime) means switching
  language never waits on a network request — directly satisfies SC-001 ("under 2 seconds, no
  full page reload") with room to spare, and keeps missing-key fallback (FR-011) a simple object
  lookup rather than an async-loading edge case.

**Alternatives considered**:

- `@ngx-translate/core` — mature, widely used, but pulls in `HttpClient`-based async JSON loading
  by default (extra complexity/failure mode for a 2-language, dozens-of-keys catalog) and an
  external dependency for functionality the codebase already implements by hand elsewhere.
- `@jsverse/transloco` — similar tradeoff; richer feature set (lazy scopes, ICU) than this feature
  needs.
- `@angular/localize` — rejected outright; wrong tool (build-time, not runtime-switchable).

## #2: Where the supported-language catalog lives

**Decision**: A new `libs/api-contract/src/lib/i18n.ts` exporting a `SUPPORTED_LANGUAGES` constant
array (`{ code, label, isDefault }[]`) and a derived `LanguageCode` union type (`'en' | 'de'`).
Both the frontend (switcher options, email-language settings options, dictionary keys) and the
backend (validating `PATCH /profile/email-language` input) import this one source of truth.

**Rationale**: FR-012 requires the display switcher and the email-language setting to present an
identical list — a single shared constant is the only way to guarantee that without duplicated
lists drifting apart. `libs/api-contract` already exists precisely to hold shared DTOs/types
between the two tiers (Stack Decision), so this doesn't require a new library.

**Alternatives considered**: A backend-only `GET /api/i18n/languages` endpoint — rejected as an
unjustified network round-trip and runtime dependency for a small, build-time-known, rarely
changing list (adding a language is a code change and redeploy either way, per spec Assumptions).

## #3: Email correspondence language fallback semantics (FR-008)

**Decision**: `users.email_language` is `NULL` until a user explicitly sets it (mirrors the
existing `pending_email` nullable-column pattern). While `NULL`, any backend process needing a
language for that user's correspondence uses the application default language (`en`). The
Settings > Preferences control pre-fills its picker with the user's _current display language_ (read
client-side from `I18nService`) as a suggested starting value when no explicit setting exists yet,
but that pre-fill only becomes the stored value once the user saves it — it is never written to
`users.email_language` implicitly.

**Rationale**: The spec's Assumptions section is explicit that display language is deliberately
per-device/browser only and never synced to the account, specifically so it stays decoupled from
the account-level, backend-readable email-language setting. That means the backend genuinely
cannot know "the user's current display language" for an unset email preference — only the
browser that made the most recent switch knows it, and a user may have several. Treating "falls
back to display language if known" as a client-side pre-fill convenience (satisfies the spirit of
FR-008 and SC-004's "falling back correctly when unset") rather than a server-side lookup keeps
the two settings genuinely independent (FR-009) and avoids inventing a sync mechanism the spec's
Assumptions explicitly rule out.

**Alternatives considered**: Have the frontend send its current display language alongside every
authenticated request so the backend could cache a "last known display language" per user —
rejected as scope creep: it would blur the deliberate device/account boundary the spec draws, for
a fallback path (FR-008's secondary case) that already has a well-defined default (application
default language).

## #4: Database migration shape

**Decision**: A new `migrateI18n(db)` step in `DatabaseService`, called from `onModuleInit`
alongside the existing `migrateProfile()`, following the exact same idempotent
`PRAGMA table_info` check-then-`ALTER TABLE` pattern already used for `pending_email`,
`archived_at`, etc.:

```sql
ALTER TABLE users ADD COLUMN email_language TEXT NULL
  CHECK (email_language IS NULL OR email_language IN ('en', 'de'))
```

(SQLite's `ALTER TABLE ADD COLUMN` doesn't support inline `CHECK` referencing app-level constants
directly, so the code generates the `IN (...)` list from `SUPPORTED_LANGUAGES`' codes at migration
time, keeping the DB constraint and the shared catalog from drifting apart.)

**Rationale**: Consistent with every other schema change in this codebase (no migration
framework/ORM, per Principle V and `database.service.ts`'s existing documented pattern).

**Alternatives considered**: A separate `user_preferences` table — rejected as unnecessary
normalization for a single nullable column with the same lifecycle as other `users` columns
(`pending_email`, `archived_at`).
