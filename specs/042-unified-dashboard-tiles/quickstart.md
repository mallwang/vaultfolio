# Quickstart: Validating Unified Dashboard Tiles

## Prerequisites

- `npm ci` done; frontend and backend running as described in the `verify-ui` skill.
- Test account from `.env.local` (`VAULTFOLIO_TEST_EMAIL` / `VAULTFOLIO_TEST_PASSWORD`) with the synthetic data set; sign in via the `verify-ui` login helper.

## Automated checks

```bash
npx nx affected -t lint,typecheck,test
```

Expected: all pass; new specs cover the frame (toggle, `aria-expanded`, fallback state, no toggle without details), the layout parser (`expanded` default/invalid values/reset) and widgets (details absent while collapsed).

## Manual scenarios (Playwright via `verify-ui`)

1. **Uniform tiles (US1)**: open `/app`; every headline amount has the same computed font size; every tile is at least `14rem` high; no tile shows details.
2. **Expand (US2)**: click `<prefix>-toggle` on one tile; its details appear, the toggle reports `aria-expanded="true"`, row neighbours have the same height and their details stay hidden.
3. **Collapse**: click again; the row returns to its minimum height.
4. **Keyboard**: focus the toggle, press Enter/Space; state toggles.
5. **Persistence (FR-010)**: expand a tile, reload; the tile is still expanded. Collapse, reload; collapsed.
6. **No details**: the Gesamtwert tile has no toggle.
7. **Edge states (US3)**: put a domain into maintenance (admin), check empty/loading/unavailable tiles keep header and minimum height; reorder tiles and hide/show one in the edit dialog.
8. **Mobile**: width 400px; one tile per row, each with minimum height and its own toggle.
9. **Themes/languages**: repeat 1 and 2 in dark theme and in German and English; the toggle label is translated.

## Quality gates

Run `speckit-sonar-local` / `speckit-sonar-validate` before considering the implementation done.
