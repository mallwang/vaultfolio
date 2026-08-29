# Design: Admin Account Management & Invitations

## Approach

Nested under the existing **Settings** application area (`apps/frontend/src/app/core/layout/application-areas.ts`) as two sub-tabs, **Accounts** and **Invitations**, rather than a new top-level nav item. Rationale: this is an admin-only management surface used infrequently, not a daily-use area like Dashboard/Holdings/Imports — Settings is the natural existing home and the spec doesn't fix a location.

Visual language reuses the app shell (sidebar/header), data-table, dialog, button, and form-field patterns established and approved in `specs/003-manual-holdings-entry/mockup.html`, so this feature reads as the same product rather than a new one. Approximates PrimeNG's Aura preset defaults (emerald primary, neutral surface grays) — exact tokens finalized when PrimeNG theming is fully wired up.

The invitee-facing accept/expired pages are deliberately **outside** the app shell — no sidebar, no header, no "signed in as" — because the invitee has no session at that point (Edge Case: token consumed only on successful activation).

## Sketch

```
┌─────────────────────────────────────────────────────────┐
│ Sidebar │ Settings                        markus.allwang │
│         │ ┌───────────────┐                              │
│  ...    │ │Accounts│Invit.│                               │
│         │ └───────────────┘                              │
│ Settings│ ┌─────────────────────────────────────────────┐│
│ (active)│ │ Name | Email | Role | Status |            │  ││
│         │ │ ...rows, last-admin badge/disabled controls│  ││
│         │ └─────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────┘

Invitee link →  ┌───────────────────┐   (no app shell)
                 │   Vaultfolio      │
                 │ You've been invited│
                 │ [password fields] │
                 │ [Activate account]│
                 └───────────────────┘
```

## Regions & states

- **Accounts tab (default)** — combined active + archived list in one table; role is an inline `<select>`, disabled for the sole active admin; archived rows show a "N days left" countdown pill and a reactivate action instead of archive. Traces to FR-001 (list all accounts), FR-002 (role change), FR-003/FR-004 (archive/reactivate), Key Entity "User Account extension".
- **Last-admin-blocked banner** — warning banner shown on the Accounts tab when an action would violate the last-admin invariant; same copy/placement regardless of whether the action was demote, archive, or self-delete (Edge Cases — one shared server-side rule surfaced identically). Traces to FR-005 (last-admin invariant), FR-006 (403 for non-admins — not visually mocked, API-only).
- **Archive-confirm dialog** — destructive-action confirmation naming the retention window (30-day default per spec Assumptions) and that the user is signed out immediately. Traces to FR-003.
- **Invitations tab** — pending/accepted/expired invitations list with resend and cancel row actions; "Invite member" primary action opens the invite dialog. Traces to FR-007 (invite by email), FR-011 (cancel/resend).
- **Invite dialog** — email + role fields; hint clarifies the invitee sets their own password. Traces to FR-007, FR-008 (role assignment on invite).
- **Invite dialog — already exists** — inline form error when the email already has an active or archived account, naming the conflict and pointing at reactivation instead. Traces to FR-009 (reject duplicate email), FR-010 (supersede-on-resend — same dialog, different message, not separately mocked since it's a toast/list-state change, not a new screen).
- **Accept-invite page** (invitee-facing, no app shell) — shows the invited email (read-only) and role context, password + confirm fields. Traces to FR-012 (invitee sets own password to activate).
- **Invite-expired/used page** (invitee-facing, no app shell) — neutral messaging for an already-used, cancelled, or expired link; explicitly reassures nothing changed. Traces to Edge Cases (expired/reused token handling).
- **Viewport** — desktop (sidebar) and mobile (collapsed top bar) both covered via the mockup's viewport toggle, matching the existing app shell's `768px` breakpoint.

## Out of scope for this mockup

- The 403 response a non-admin gets calling these routes directly (API-only, no screen).
- Concurrent-edit/race resolution between two admins acting on the same account.
- The automatic 30-day retention sweep job — runs without any admin action or screen.
- Email delivery/SMTP integration — deployment concern per spec Assumptions.
- Exact password-policy validation copy — reuses spec 005's rules verbatim, not re-specified here.

## Mockup

Local durable copy: [`mockup.html`](./mockup.html)
Original review Artifact (may go stale): https://claude.ai/code/artifact/2fce82e1-58d0-45b2-b085-5eeb4223251c
