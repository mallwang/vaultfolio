# Quickstart: Validating the Material Icons Swap

## Prerequisites

- Node/npm installed per the repo's usual setup (`npm install` at the workspace root — this repo
  uses npm, not pnpm/yarn; see project conventions).
- Frontend dev server runnable via Nx: `npm exec nx serve frontend`.

## 1. Visual sweep (User Story 1 / SC-001, SC-003)

```bash
npm exec nx serve frontend
```

Open the app and walk every major area named in the spec's Independent Test: dashboard, holdings,
admin, auth (login/register), profile/settings. For each screen:

- Confirm every icon renders as a Material Symbols glyph (rounded/outlined line-icon style), not a
  PrimeIcons glyph.
- Confirm no broken/empty icon glyphs (tofu boxes, missing-square placeholders) appear.

**Automated check** — confirm no PrimeIcons references remain anywhere in the frontend source:

```bash
grep -rE "pi pi-|['\"]pi-[a-z]" apps/frontend/src && echo "FAIL: PrimeIcons reference found" || echo "PASS: no PrimeIcons references"
grep -rn "primeicons" apps/frontend/src apps/frontend/package.json package.json 2>/dev/null && echo "FAIL: primeicons still referenced" || echo "PASS: primeicons not referenced"
```

Both checks must print `PASS`.

## 2. Interactive/meaning-preserving controls (User Story 2 / SC-002)

Exercise each of the following and confirm the icon still conveys the same action/state as before:

- A form's delete/edit/close affordances (e.g. holding row delete, edit-in-place).
- `p-dialog` close icon and `p-confirmdialog` icon + close.
- `p-select` / `p-datepicker` dropdown trigger icon.
- `p-table` column sort icons (ascending/descending/unsorted states).
- `p-toast` / `p-message` severity icons (success, warning, error, info) — confirm each remains
  visually distinct from the others.
- Sidebar/nav icons and the light/dark theme toggle icon.
- Loading/spinner icon (`pi-spin` equivalent) — confirm it still animates.

## 3. Theming & states (FR-004)

- Toggle light/dark mode: icons must remain visible and correctly colored in both.
- View a disabled button/control with an icon: icon must visually reflect the disabled state the
  same way it did before (dimmed/reduced opacity, consistent with the control's other disabled
  styling).
- Resize/zoom: icons must scale with their surrounding control (no fixed-pixel glyphs that clip or
  overflow at larger button sizes).

## 4. Unknown-icon fallback (FR-007)

In dev, temporarily render `<vf-icon name="this-name-does-not-exist" />` anywhere in a template:

- Expect a visibly distinct fallback glyph (not a blank/empty span) and a `console.warn` in the
  browser devtools console.
- Remove the temporary usage after confirming.

## 5. Accessibility spot-check (FR-008)

- Using a screen reader (or the browser's accessibility tree inspector), confirm a decorative icon
  (e.g. next to a text label) is not announced as redundant noise (`aria-hidden`).
- Confirm an icon-only button (no visible text label) still announces a meaningful name (via the
  button's own `aria-label`, unchanged from before this feature).

## 6. Documentation check (User Story 3 / SC-004)

```bash
grep -n "Icon library" .specify/memory/constitution.md
```

Confirms the constitution's Stack Decision names Material Icons as the sole, required icon library
and that PrimeIcons is documented as prohibited (already true as of constitution v3.1.0 — no
action needed by this feature beyond keeping the code compliant with it).
