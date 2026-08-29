# Design: Profile, Password & Account Self-Service

## Approach

Adds a new **Profile** sub-tab to the existing Settings application area
(`apps/frontend/src/app/core/layout/application-areas.ts` → `settings.component.html`), positioned
**first**, ahead of the admin-only Accounts/Invitations/Sign-ups tabs — this is the one sub-tab
every signed-in user (not just admins) needs, so it leads. It also fills the "Preferences...Coming
soon" placeholder already sketched in the General tab's card, per spec (settings.component.html)
at the time of writing.

The signed-out forgot-password/reset-password pages and the shared expired-or-used-link page
render **outside** the app shell, the same way 006's accept-invite/invite-expired pages do — no
sidebar, no header, no "signed in as" — since the user may have no session at that point.

Visual language reuses the app shell (sidebar/header), settings-tabs, card, field-group, dialog,
banner, and button patterns already approved in `specs/006-admin-accounts-invitations/mockup.html`
verbatim (same CSS custom properties, same class names) so this reads as the same product, not a
new one. Approximates PrimeNG's Aura preset defaults; exact tokens finalized when PrimeNG theming
is fully wired up. Two elements are new here and not yet established elsewhere in the app:

- **`.role-badge`** in the app header — small pill next to the display name (e.g. "Admin"),
  satisfying FR-004's requirement that the header reflect role, not just name/avatar. There is no
  uploaded-avatar concept anywhere in the app (confirmed against the current codebase); "avatar" in
  FR-004 refers to the existing initials-circle already implemented in `app-header.component.ts`,
  not a new upload feature — not re-specified or re-mocked here.
- **`.danger-zone`** card — a visually distinct red-tinted card (border `#fecaca`, background
  `var(--p-danger-background)`), the first "Danger Zone" pattern in the app; reusable verbatim by
  any future feature that needs one.

## Sketch

```
┌─────────────────────────────────────────────────────────┐
│ Sidebar │ Settings                    markus.allwang Admin (●)│
│         │ ┌──────────────────────────────┐                │
│  ...    │ │Profile│Accounts│Invit.│Signups│General│         │
│         │ └──────────────────────────────┘                │
│ Settings│ ┌───────────────────────────────┐               │
│ (active)│ │ [avatar] Markus Allwang        │               │
│         │ │ Display name: [___________] [Save]│           │
│         │ │ ─────────────────────────────  │               │
│         │ │ Current email: markus...@tuta.com (locked)│    │
│         │ │ Change email to: [___________] [Send link]│    │
│         │ ├───────────────────────────────┤               │
│         │ │ Change password                │               │
│         │ │ Current / New / Confirm [Change password]│     │
│         │ ├─── Danger Zone (red card) ─────┤               │
│         │ │ [Export data]  [Delete account]│               │
│         │ └───────────────────────────────┘               │
└─────────────────────────────────────────────────────────┘

Signed out →  ┌───────────────────┐   (no app shell)
              │   Vaultfolio      │
              │ Forgot your pw?   │
              │ [email] [Send]    │
              └───────────────────┘
```

## Regions & states

- **Profile tab (default)** — one column of stacked cards: identity/display-name card, email
  card, password card, and the Danger Zone card. Traces to FR-001 (display name 1–100 chars),
  FR-004 (header reflects identity live, no reload).
- **Email change pending banner** — `banner--info` shown above the email fields once a change is
  outstanding, naming the pending address and reassuring the current one still works, with a
  "Cancel request" action. Traces to FR-002 (supersede-on-resubmit is the same banner, just its
  target address changes — not separately mocked as a new screen), FR-003 (conflict is a form
  error, same `field-error`/`error-msg` pattern as invite-dialog in 006 — not separately mocked).
- **Password — wrong current password** — inline `field-error` + `error-msg` under the "Current
  password" field, nothing else on the page changes. Traces to FR-005, FR-007 (shared password
  policy hint text, "8–200 characters", copied verbatim from the Assumptions section).
- **Danger Zone — three dialog states** (confirm / final / blocked): step 1 advises optional
  export without requiring it; step 2 is the explicit final-confirmation step (type-to-confirm
  gates the destructive button); blocked reuses the exact "sole administrator" messaging pattern
  from 006's Accounts tab last-admin banner, applied here to self-deletion. Traces to FR-008,
  FR-009, FR-010 (a server error during deletion reuses the existing `form-alert` pattern inside
  the same dialog — not mocked as a distinct screen, since it's the identical shape already
  established in 006/007's dialogs).
- **Forgot-password / sent / reset-password pages** (signed-out, no app shell) — traces to FR-006
  and SC-003: the "sent" confirmation page's copy is deliberately identical regardless of whether
  the submitted address has an account.
- **Link-invalid page** (signed-out, no app shell) — one shared page for both an expired/used
  password-reset link and an expired/used/superseded email-change-verification link, matching the
  spec's Key Entities section (`Email Verification Token`, one mechanism with a `purpose` field for
  both). Traces to Edge Cases / SC-002.
- **Viewport** — desktop (sidebar) and mobile (collapsed top bar) both covered via the mockup's
  viewport toggle, matching the existing app shell's breakpoint.

## Out of scope for this mockup

- The email-change verification link's own success landing (mirrors the existing sign-in page —
  no new screen).
- Server-error-during-deletion visual state — reuses the `form-alert` pattern already established
  in 006/007's dialogs verbatim, not a new layout.
- Timing-attack resistance of the forgot-password response (server-side property, no UI).
- The exact route a non-admin's self-delete request lands on
  (`AccountsService.deleteSelf` exists but its only current HTTP route is admin-gated — a planning
  decision, not a layout one).
- Session-exclusion semantics ("other" sessions vs. all sessions) — a backend behavior decision,
  not visible in this mockup.

## Mockup

Local durable copy: [`mockup.html`](./mockup.html)
Original review Artifact (may go stale): https://claude.ai/code/artifact/facab06b-f54e-4294-89a8-be8444855e11
