# Design: Light/Dark Theme Switch

**Mockup**: [mockup.html](./mockup.html) (local, durable copy) — originally reviewed at https://claude.ai/code/artifact/f1c553bf-127d-45ae-9216-2f8aa084a6da (Artifact link may go stale).

## Approved layout

### Authenticated header

The existing `app-header` right-hand cluster (`app-header__meta`) gains one more item, inserted immediately before the sign-out button:

```
[ display name ]  [ role badge ]  [ avatar ]  [ ☀/🌙 toggle ]  [ Sign out ]
```

- The toggle is **icon-only** — a circular ghost button (no border, no text label), 30×30px, matching the visual weight of an icon-affordance next to the existing text-and-icon sign-out button.
- It shows a sun icon in light theme, a moon icon in dark theme (swap on click), matching the _currently active_ theme rather than the theme it switches to — i.e. it reads as a state indicator, not just a switch (satisfies FR-009).
- `aria-pressed` reflects dark/light state; `aria-label` says "Switch to light theme" / "Switch to dark theme" depending on current state (FR-008).
- Placed next to sign-out, not below it, to keep the header row compact and leave room for a future control in the same cluster (e.g. a language switcher) — this was an explicit correction from the initial "beneath sign-out" phrasing in the spec input, made during this review.

### Unauthenticated header

Same icon-only toggle, alone, in the equivalent right-hand position of the header (no sign-out button, no name/badge/avatar to sit alongside).

### Responsive behavior

No special-casing needed: the toggle is a single small icon button that sits in the existing header meta cluster, which already reflows correctly on mobile as part of the current app shell (verified in the mockup's desktop/mobile toggle).

### Interaction

Clicking the toggle changes the active theme immediately (no page reload) — demonstrated in the mockup with a real (if simplified) light/dark token swap on the canvas, not just a static screenshot.

## Requirement traceability

| Spec item                 | How the mockup addresses it                                                                    |
| ------------------------- | ---------------------------------------------------------------------------------------------- |
| FR-001                    | The toggle control itself, present in the header.                                              |
| FR-002                    | Icon-only toggle placed next to (not beneath) the sign-out button, authenticated header.       |
| FR-003                    | Same toggle, equivalent position, unauthenticated header (no sign-out button).                 |
| FR-004                    | Live click-to-switch demo in the canvas — the visual change is instant.                        |
| FR-009                    | Icon reflects current theme (sun = light active, moon = dark active) rather than being static. |
| Edge case: assistive tech | `aria-pressed` + dynamic `aria-label` on the toggle button.                                    |

## Out of scope for this mockup

These are behavioral/data concerns with no distinct visual state beyond what the toggle already shows, so they weren't separately mocked:

- **FR-005** (persisting the choice across visits) — no visible difference in the mockup; it's a storage concern.
- **FR-007** (defaulting to OS `prefers-color-scheme`) — the mockup defaults to light on load; the real app's first-load default depends on the visitor's OS setting, which isn't something a static mockup can vary meaningfully.
- Full dark-theme token values for the rest of the app (charts, forms, tables, etc.) — the mockup approximates a plausible PrimeNG Aura-dark palette on the shell chrome only, to make the toggle's effect visible; exact tokens are a planning/implementation concern once PrimeNG theming is configured (see `specs/002-primeng-app-structure/spec.md`).

## Visual language note

Vaultfolio has no PrimeNG theme file wired up yet as of this feature. The mockup approximates PrimeNG's default "Aura" preset for light mode (matching prior mockups, e.g. `specs/009-app-shell-restructure/mockup.html`) and a plausible Aura-dark palette for the dark state. Exact design tokens for dark mode should be finalized against PrimeNG's actual dark-mode token set when implemented, not hand-derived from this approximation.
