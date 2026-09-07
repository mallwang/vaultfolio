# api-contract

Plain TypeScript interfaces and literals shared between `apps/backend` and `apps/frontend`. No
runtime framework dependency (Principle II) — both tiers import the same types so they can never
silently drift on wire shape.

## Exported modules

| Module                | Contents                                                                                                       |
| --------------------- | -------------------------------------------------------------------------------------------------------------- |
| `health.ts`           | `GET /health` response shape                                                                                   |
| `auth.ts`             | Sign-in/session types, session error codes                                                                     |
| `accounts.ts`         | Admin user-accounts API (account summary, role change, domain-scopes, error codes)                             |
| `account-overview.ts` | Account Overview CRUD types (`AccountCategory`, `AccountStatus`, `AccountOverviewEntry`, error codes)          |
| `invitations.ts`      | Invitation API types (create, list, cancel, accept, error codes)                                               |
| `signups.ts`          | Self-service signup API types (request, verify, admin review, error codes)                                     |
| `profile.ts`          | Profile/password/settings API types (display name, email, password, preferences)                               |
| `holdings.ts`         | Holdings API types (`AssetType`, `HoldingDto`, create/update/import request types, error codes)                |
| `i18n.ts`             | `SUPPORTED_LANGUAGES` — single source of truth for the language catalog (frontend picker + backend validation) |

## Running unit tests

Run `npm exec nx test api-contract` to execute the unit tests via Jest.
