# Contract: Frontend Route Table (post-restructure)

This is a client-side routing contract (`apps/frontend/src/app/app.routes.ts`) — there is no new
backend API surface in this feature. It documents the addresses the application MUST expose after
this feature, superseding the current flat route list.

## Public routes (no `/app` prefix, no auth required)

| Path                             | Component                 | Shell       |
| -------------------------------- | ------------------------- | ----------- |
| `/sign-in`                       | `SignInComponent`         | Header only |
| `/signup`                        | `SignupComponent`         | Header only |
| `/signup/verify/:token`          | `VerifyComponent`         | Header only |
| `/invite/expired`                | `ExpiredComponent`        | Header only |
| `/invite/:token`                 | `AcceptComponent`         | Header only |
| `/account/link-invalid`          | `LinkInvalidComponent`    | Header only |
| `/account/verify-email/:token`   | `VerifyEmailComponent`    | Header only |
| `/account/forgot-password`       | `ForgotPasswordComponent` | Header only |
| `/account/reset-password/:token` | `ResetPasswordComponent`  | Header only |

All public routes gain the header (FR-001) that some of them (`/invite/*`, `/signup*`,
`/account/*`) previously rendered without, per the shell-less list in current `app.ts`. None of
them render the sidebar (FR-006). None of them show identity content in the header while signed
out (FR-009).

## Authenticated routes (under `/app`, auth required)

| Path             | Component            | Guard                               |
| ---------------- | -------------------- | ----------------------------------- |
| `/app/dashboard` | `DashboardComponent` | `authGuard` (on parent `app` route) |
| `/app/holdings`  | `HoldingsComponent`  | `authGuard` (on parent `app` route) |
| `/app/imports`   | `ImportsComponent`   | `authGuard` (on parent `app` route) |
| `/app/settings`  | `SettingsComponent`  | `authGuard` (on parent `app` route) |

Rendered inside the authenticated shell: header (with identity content, FR-008) + sidebar
(FR-004) + routed content.

Requesting any `/app/...` address while unauthenticated MUST redirect to `/sign-in` (FR-011) —
enforced by `authGuard` on the parent `app` route, same mechanism as today's per-route guard.

## Legacy redirects (FR-013)

| Old path     | Redirects to     |
| ------------ | ---------------- |
| `/`          | `/app/dashboard` |
| `/dashboard` | `/app/dashboard` |
| `/holdings`  | `/app/holdings`  |
| `/imports`   | `/app/imports`   |
| `/settings`  | `/app/settings`  |

A redirect to an `/app/...` address is itself still subject to `authGuard` on arrival — an
unauthenticated visitor following a legacy link still lands on `/sign-in`, not the protected page
(consistent with FR-011/FR-012).

## Not-found

`NotFoundComponent` is reachable two ways, each with its own `**` wildcard route, so the shell
context (and therefore sidebar visibility) matches where the unmatched URL was under:

- A child `**` route under the `app` parent (guarded like its siblings) — an unmatched
  `/app/...` address renders `NotFoundComponent` inside the authenticated shell (header + sidebar).
- A top-level `**` route (unchanged from today) — any other unmatched address renders
  `NotFoundComponent` with the header only, no sidebar.

Per the spec's Edge Cases: the header is always present on either variant; the sidebar is present
only when the visitor is signed in at the time (i.e. only on the `/app/**` variant).
