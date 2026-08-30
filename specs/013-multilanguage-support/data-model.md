# Data Model: Multilanguage Support

## Supported Language (catalog)

Static, shared, build-time-known list — not a database table (research.md #2).

Defined in `libs/api-contract/src/lib/i18n.ts`:

| Field       | Type      | Notes                                                                                                    |
| ----------- | --------- | -------------------------------------------------------------------------------------------------------- |
| `code`      | `string`  | ISO 639-1 code, e.g. `'en'`, `'de'`. Also the `LanguageCode` union.                                      |
| `label`     | `string`  | Display name shown in both the switcher and the settings picker (FR-012), e.g. `'English'`, `'Deutsch'`. |
| `isDefault` | `boolean` | Exactly one entry is `true` (`'en'`) — the application default (FR-005).                                 |

At launch: `[{ code: 'en', label: 'English', isDefault: true }, { code: 'de', label: 'Deutsch', isDefault: false }]`.
Adding a language later (FR-010) is a one-line addition to this array plus a new
`translations/<code>.ts` dictionary — no switcher/settings code changes required.

## User Language Preference (display language)

Not a database entity — lives entirely client-side (spec Assumptions; research.md #3).

| Attribute | Type               | Storage                               |
| --------- | ------------------ | ------------------------------------- |
| `code`    | `LanguageCode`     | `localStorage['vaultfolio-language']` |
| Scope     | per-device/browser | not synced to the account (FR-004)    |

**Lifecycle** (mirrors `010-theme-switch`'s `ThemeService`):

1. On `I18nService` construction, resolve: explicit stored value (if it's a currently-supported
   code) → else the catalog's default (`en`). No browser/OS-locale auto-detection (spec
   Assumptions).
2. Resolved language is held in a signal and applied immediately (drives the `translate` pipe);
   no page reload.
3. An explicit switcher selection updates the signal and persists to `localStorage`, best-effort
   (a thrown/blocked `localStorage` write doesn't break the in-memory switch, same as
   `ThemeService.writeStoredTheme`).
4. A stored code that is no longer in the catalog (a removed language) is treated as "no explicit
   choice" and falls back to the default (edge case in spec.md).

## Email Correspondence Language Setting

Persisted as part of the existing **User Account** entity (`users` table), a new nullable column:

| Column           | Type         | Constraint                                                     |
| ---------------- | ------------ | -------------------------------------------------------------- |
| `email_language` | `TEXT`, NULL | `NULL` or one of `SUPPORTED_LANGUAGES`' codes (research.md #4) |

- **`NULL`** = not explicitly set → callers generating correspondence MUST treat this user as the
  application default language (`en`) (FR-008, research.md #3).
- **Non-`NULL`** = explicitly set by the user via `PATCH /profile/email-language`; independent of,
  and unaffected by, the display language (FR-009) and any other account field.
- No `updated_at`/history tracking — same granularity as other single-value profile settings
  (`display_name`) in this codebase; the edge case about a value changing while a cron email is
  "in flight" is resolved by the future cron feature simply reading whatever value is current at
  generation time (spec Edge Cases), which requires no extra state here.

`ProfileSummary` (shared DTO, `libs/api-contract/src/lib/profile.ts`) gains:

```ts
emailLanguage: LanguageCode | null; // null = not explicitly set (falls back to 'en')
```

## Relationships

```
User Account (users)
  └─ email_language: LanguageCode | null   (this feature; account-level, backend-readable)

(no DB relationship to "display language" — that preference never reaches the backend)

SUPPORTED_LANGUAGES (static catalog, libs/api-contract)
  ├─ used by: frontend language switcher (display language)
  ├─ used by: frontend/backend email-language setting UI + validation
  └─ used by: frontend translation dictionaries (one dictionary per catalog entry)
```

## Validation Rules

- `PATCH /profile/email-language` request body's `emailLanguage` MUST be either `null` (explicitly
  reverting to "no preference") or a code present in `SUPPORTED_LANGUAGES`; any other value is
  rejected with the existing structured-error convention (400, `invalid_email_language`).
- The DB `CHECK` constraint (research.md #4) is a defense-in-depth backstop, not the primary
  validation layer — the service layer validates against the shared catalog first, same as every
  other profile field in this codebase (e.g. display-name length in `ProfileService`).
