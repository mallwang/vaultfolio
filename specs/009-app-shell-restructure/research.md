# Research: App Shell Restructure

## 1. Where does the header render from?

**Decision**: Hoist `AppHeaderComponent` out of `AppShellComponent` and into the root `App`
component's template, so it renders once, above the `router-outlet`, for every route — including
the currently shell-less public routes (`/invite/*`, `/signup*`, `/account/*`, `/sign-in`).
`AppShellComponent` is narrowed to just the sidebar + content region used by the authenticated
`/app` section.

**Rationale**: FR-001 requires the header on 100% of pages. The header is currently only rendered
by `AppShellComponent`, which several public routes already opt out of entirely (`App.shellless`
in [app.ts](../../apps/frontend/src/app/app.ts)). Making the header a sibling of the routed content
at the root, rather than a child of the authenticated shell, is the smallest change that satisfies
"always visible" without duplicating the header markup into every shell-less route.

**Alternatives considered**:

- Keep header inside `AppShellComponent` and also render a second copy for shell-less routes —
  rejected: duplicates markup/behavior (two places computing `activeAreaTitle`, sign-out, etc.),
  and it's exactly the "organizational-only" duplication Principle V's simplicity guidance warns
  against.
- Route-level layout components that each embed a header — rejected: more moving parts than a
  single root-level header for no additional benefit, given the header's content doesn't vary by
  route beyond the auth state it already reads from `CurrentUserStore`.

## 2. How is auth state known before first paint (no flash of identity)?

**Decision**: Introduce an app-level "auth status" resolution step that runs once at bootstrap
(alongside, not duplicating, `authGuard`'s existing `GET /api/auth/session` call), producing a
tri-state signal (`unknown | authenticated | unauthenticated`) that both the header and the
sidebar/shell read. The header renders no identity content (name, role badge, avatar, sign-out)
while status is `unknown`; the shell renders no sidebar while status is `unknown` or
`unauthenticated`.

**Rationale**: The Edge Cases section explicitly forbids identity content flashing on a public
page before auth state is known or during sign-out. `CurrentUserStore` today only becomes
populated as a side effect of `authGuard` running on a protected route — a visitor loading a
public page never triggers it, so "no user" and "not yet checked" are indistinguishable today.
Making that a real third state removes the ambiguity without changing what `authGuard` already
does for protected routes.

**Alternatives considered**:

- Only check session on protected routes as today, treat "no store value" as "signed out" on
  public routes — rejected: this is exactly the flash scenario the spec calls out (a session that
  is in fact valid would render "signed out" header content for a moment on a public page, e.g.
  immediately after a hard refresh on `/sign-in` while already authenticated elsewhere).
- Block app bootstrap on the session check (`APP_INITIALIZER`/`provideAppInitializer`) — considered
  as the mechanism for populating the tri-state signal above; kept as the implementation approach
  for Phase 2 rather than a rejected alternative, since it directly produces the "unknown until
  resolved" state the header/shell need without a visible loading route change.

## 3. How do authenticated routes move under `/app` without breaking existing links?

**Decision**: Nest the four authenticated routes (`dashboard`, `holdings`, `imports`, `settings`)
as children of a new `app` parent route that carries `authGuard` once (rather than per-child, as
today) and renders `AppShellComponent` (sidebar + content) as the parent's component. Add one
`redirectTo` route per old top-level path (`dashboard` → `app/dashboard`, etc.) so bookmarks and
existing links keep resolving. The root `''` redirect changes from `dashboard` to `app/dashboard`.

**Rationale**: FR-002/FR-003 require the `/app` split; FR-013 requires old addresses to keep
working; FR-012 requires access control to remain equivalent to today's (guard-per-route). Putting
`authGuard` on the parent route is equivalent to today's per-route guard (Angular re-evaluates
`canActivate` on the parent for every child navigation) and removes four repeated
`canActivate: [authGuard]` lines. Plain `redirectTo` entries are the simplest mechanism satisfying
"reach the equivalent working page" (FR-013) — no new redirect infrastructure needed.

**Alternatives considered**:

- Server-side redirects (backend 301s) — rejected: these are pure client-side SPA routes with no
  distinct server-rendered pages per route; the redirect only needs to happen in the Angular
  router.
- Guard on every child route as today, just prefixed with `/app` — rejected in favor of a single
  parent-level guard: functionally equivalent but repeats the same `canActivate` array four times
  (Principle V simplicity).

## 4. Does the sidebar move, and does `AppShellComponent` still make sense as a name?

**Decision**: `AppShellComponent` keeps its name but its scope narrows to "authenticated
layout" — sidebar + routed content — and it is used only as the `component` of the new `app`
parent route. `AppSidebarComponent` is unchanged internally (still reads `APPLICATION_AREAS`).

**Rationale**: Minimizes churn — the sidebar's own logic, the mobile breakpoint behavior, and the
`APPLICATION_AREAS` contract (`contracts/application-areas.md` from prior features) are all
unaffected by this feature; only where `AppShellComponent` sits in the tree changes (child of the
`app` route instead of the thing `App` always renders).

**Alternatives considered**: Rename to `AppAuthenticatedLayoutComponent` — rejected as unnecessary
churn/YAGNI; the existing name is still accurate enough ("the shell for the authenticated area")
and renaming has no behavioral value for this feature.

## 5. Session-expiry mid-session on an `/app/...` page

**Decision**: No new mechanism — this is already handled by the existing `authInterceptor` (per
`auth.guard.ts`'s doc comment) which redirects to `/sign-in` on a 401 from any in-flight request.
Confirmed this satisfies the Edge Case ("session expires while on `/app/...`, redirect to
sign-in") with no changes required beyond the route relocation itself.
