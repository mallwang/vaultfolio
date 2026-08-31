# Phase 0 Research: Material Icons as Default Icon Library

## 1. Which Material icon set, and how is it loaded?

**Decision**: Use **Material Symbols Outlined** (variable font), loaded via a `<link>` in
`apps/frontend/src/index.html`, the same self-hosted-via-Google-Fonts pattern already used for the
Inter font:

```html
<link
  href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,400,0..1,0"
  rel="stylesheet"
/>
```

Glyphs are rendered as text ligatures inside a `<span class="material-symbols-outlined">home</span>`,
per Google's standard usage.

**Rationale**: "Material Symbols" is Google's current, actively maintained icon set (successor to
the older "Material Icons" font); it ships one variable font covering all glyphs plus fill/weight/
optical-size axes, which covers PrimeIcons' need for a `pi-spin` (loading) treatment via a CSS
rotation animation on the span, same as today. Outlined style is the closest visual match to
PrimeIcons' existing line-icon look, minimizing visual disruption beyond the intended style
refresh. Loading via Google Fonts matches the project's existing font-loading convention (no new
build tooling, no self-hosted font pipeline).

**Alternatives considered**:

- `@material-symbols/svg-*` npm package (per-icon SVG import): more tree-shakeable but requires a
  build-time icon registry and per-icon import wiring — more machinery than this app's icon count
  (~30 names) justifies (YAGNI, Principle V).
- Material Design Icons (community superset, `@mdi/font`): more glyphs than needed and not the
  library the spec/constitution names ("Google's Material Icons" specifically).

## 2. How to replace ad-hoc `pi pi-*` usages in app templates

**Decision**: Introduce a single reusable `<vf-icon name="...">` Angular standalone component
(`apps/frontend/src/app/shared/icon/icon.component.ts`) that:

- Renders `<span class="material-symbols-outlined" [class.vf-icon--spin]="spin">{{ glyph }}</span>`
- Resolves `glyph` from an internal `ICON_NAME_MAP` (`icon-name.map.ts`) keyed by the same semantic
  name the app already uses (e.g. `home`, `trash`, `pencil`), so call sites read the same as
  before functionally but no longer reference `pi`/`pi-*` classes.
- Falls back to a distinctly-styled placeholder glyph (Material Symbols' `error` glyph, rendered in
  the app's error/danger color) plus a `console.warn` when `name` has no map entry — satisfying
  FR-007 (visible, not silent, gap) without breaking layout.

Existing `<i class="pi pi-xxx"></i>` usages across the ~25 files are replaced 1:1 with
`<vf-icon name="xxx" />`.

**Rationale**: A single wrapper component centralizes the name→glyph mapping (one place to fix a
wrong glyph choice, one place the unknown-icon fallback logic lives) rather than scattering
`material-symbols-outlined` spans with hardcoded glyph text through 25 files. It also gives a
single seam for FR-004 (size/color/theme via CSS custom properties already used for text color) and
for future icon additions.

**Alternatives considered**:

- Global CSS remap of `.pi.pi-xxx::before { content: "…" }`: rejected — keeps the `pi-*` class
  names in markup (violates FR-002's "no leftover previous-icon-set reference" even if visually
  swapped) and keeps a dependency on `primeicons`' class taxonomy rather than actually adopting
  Material's naming.
- Angular Material's `<mat-icon>`: rejected — pulls in `@angular/material` and its theming system
  solely for an icon component, which conflicts with Principle V (simplicity/no unjustified new
  dependency) when a ~20-line wrapper does the job.

## 3. Overriding icons baked into PrimeNG's own components

PrimeNG components render some icons internally rather than through app-level markup: `p-dialog`
(close icon), `p-select`/`p-datepicker` (dropdown trigger icon), `p-table` (sort icons), `p-toast`
and `p-message` (severity icons), `p-confirmdialog` (icon + close). PrimeNG's documented mechanism
(https://primeng.dev/customicons) is per-instance `ng-template`/`pTemplate` icon-slot overrides
(e.g. `<ng-template #closeicon>`, `#triggericon`, `#sorticon`, `#headercheckboxicon`), not a single
global font swap — because each component's internal icon is either an `<svg>` or a `pi-*` class
baked into its own template.

**Decision**: For each of the 6 PrimeNG component types actually used in this app (`p-dialog`,
`p-select`, `p-datepicker`, `p-table`, `p-confirmdialog`, `p-toast`), add the relevant icon-slot
`ng-template`(s) at each call site (or via a small shared template fragment where the same
component type is reused with identical icon needs), each rendering `<vf-icon name="...">`. Audit
`p-message`/severity icons the same way if it turns out they render via a slot rather than CSS.

**Rationale**: This is the officially documented, supported path (the spec's own Assumptions
section names it) and requires no PrimeNG version fork or CSS hacking that could break on a future
PrimeNG upgrade.

**Alternatives considered**:

- Patching `primeicons.css` itself to remap glyphs to Material Symbols codepoints: rejected — still
  depends on the `primeicons` package (contradicts "PrimeIcons MUST NOT be used", constitution
  v3.1.0) and is fragile across PrimeNG upgrades that add new internal `pi-*` references.

## 4. Accessibility (FR-008)

**Decision**: `vf-icon` defaults to `aria-hidden="true"` (decorative), matching how PrimeIcons'
`pi pi-*` spans are used today (paired with visible/adjacent text or an existing
`aria-label`/`pButton label` on the parent control). Call sites where the icon is the _only_
content of an interactive element (icon-only buttons) keep or add an explicit `aria-label` on the
parent control, same as required today — `vf-icon` itself never becomes the accessible name.

**Rationale**: Matches current behavior 1:1 (no accessibility regression, per SC-002/FR-008)
without inventing a new labeling convention.

## 5. Removing the old dependency

**Decision**: Once no `pi pi-*` class and no `@import 'primeicons/primeicons.css'` remain,
remove `primeicons` from `apps/frontend`'s dependencies (or the workspace root, wherever it's
declared) and delete the `styles.css` import.

**Rationale**: FR-002 requires full removal, not just visual override; leaving the dependency
installed but unused risks silent re-introduction in future work.
