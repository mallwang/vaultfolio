# Contract: Profile API — Email Correspondence Language

**Feature**: `013-multilanguage-support` | Extends `contracts/profile-api.md` from
`008-profile-password-account`. Shared DTOs live in `libs/api-contract/src/lib/profile.ts` and the
new `libs/api-contract/src/lib/i18n.ts`.

Adds one field to the existing `GET /api/profile` response and one new endpoint, both under the
existing `/api/profile` route, authenticated (`AuthGuard`), no `@Roles()` restriction — every
signed-in user manages their own setting, same as every other route in this controller.

## Shared type: `SUPPORTED_LANGUAGES` / `LanguageCode`

`libs/api-contract/src/lib/i18n.ts`:

```ts
export interface SupportedLanguage {
  code: string;
  label: string;
  isDefault: boolean;
}

export const SUPPORTED_LANGUAGES: readonly SupportedLanguage[] = [
  { code: 'en', label: 'English', isDefault: true },
  { code: 'de', label: 'Deutsch', isDefault: false },
];

export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number]['code'];
```

Used identically by: the frontend display-language switcher, the frontend email-language settings
picker (FR-012 — same list, same names, same source), and backend request validation.

## `GET /api/profile` (existing endpoint, extended response)

`ProfileSummary` gains one field:

```ts
emailLanguage: LanguageCode | null; // null = not explicitly set; falls back to the default language
```

No change to the endpoint's status codes or existing fields.

## `PATCH /api/profile/email-language`

Sets or clears the caller's own email correspondence language (FR-006, FR-007), independent of
their display language (FR-009).

**Request body** (`UpdateEmailLanguageRequest`):

```ts
{
  emailLanguage: LanguageCode | null;
}
```

`null` explicitly clears the setting, reverting to the default-language fallback (FR-008).

**Responses**:

| Status | Condition                                                          | Body                                                                                                        |
| ------ | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| 200    | Updated (or cleared)                                               | `ProfileSummary`                                                                                            |
| 400    | `emailLanguage` is neither `null` nor a `SUPPORTED_LANGUAGES` code | `{ "error": "invalid_email_language", "message": "Email language must be a supported language or unset." }` |

**Notes**:

- Idempotent: setting the same value twice, or clearing an already-`null` setting, both return 200
  with the unchanged `ProfileSummary` — no distinct "no-op" status, matching this controller's
  existing style (e.g. `display-name`).
- Does not send any email or trigger any notification — this endpoint only persists a preference
  for future correspondence to read (spec Assumptions: cron sending itself is out of scope).
