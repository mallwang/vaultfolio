# Data Model: Light/Dark Theme Switch

This feature introduces no backend entities, database tables, or API-contract types — it is
entirely client-side, in-browser state (spec Assumptions: "not saved to a user's account").

## Theme Preference (client-side only)

| Field   | Type                | Notes                                                                  |
| ------- | ------------------- | ---------------------------------------------------------------------- |
| `theme` | `'light' \| 'dark'` | The visitor's currently active theme. Held in `ThemeService`'s signal. |

**Storage**: `localStorage` key `vaultfolio-theme`, value `'light'` or `'dark'` (a plain string, no
JSON envelope needed — matches the narrow value domain).

**Lifecycle / resolution order** (FR-005, FR-007):

1. On `ThemeService` construction, read `localStorage.getItem('vaultfolio-theme')`.
   - If it is exactly `'light'` or `'dark'`, that is the initial `theme` value (an explicit prior
     choice).
2. Otherwise, check `window.matchMedia('(prefers-color-scheme: dark)').matches`.
   - If `true`, initial `theme` is `'dark'`.
3. Otherwise, initial `theme` is `'light'` (default).

**Transitions**:

- `toggle()`: flips `theme` between `'light'` and `'dark'`, applies the corresponding
  `app-dark` class state on `document.documentElement`, and writes the new explicit value to
  `localStorage` (subsequent visits use step 1 above, no longer step 2/3).

**Validation rules**:

- Any `localStorage` value other than exactly `'light'` or `'dark'` (missing key, cleared storage,
  corrupted/unexpected value, or a thrown exception from a blocked storage API) MUST be treated as
  "no explicit choice" and fall through to the `prefers-color-scheme` check, then the light
  default — this satisfies the spec's "browser blocks or clears local storage" edge case without
  erroring.

**Relationships**: None — not linked to `SessionUser`/`CurrentUserStore` or any account/database
entity. Explicitly per-browser (spec Assumptions).
