# Phase 0 Research: Data Export

## 1. Where does generation happen — backend or browser?

**Decision**: Entirely client-side (Angular), using data already available through the existing
per-feature REST APIs. No new backend endpoint or module.

**Rationale**:

- FR-006 requires export labels/headers/PDF text to use "the same language/translation mechanism
  already used elsewhere in Vaultfolio". That mechanism (`TranslateService` + `en.ts`/`de.ts`
  dictionaries in `libs/frontend/shared-ui`) is frontend-only today. Generating server-side would
  force either duplicating a translation dictionary into the backend (two sources of truth for the
  same strings, explicitly against Principle V's simplicity guidance) or inventing a new
  backend-to-frontend language-string protocol — both more machinery than the alternative.
- The PDF's charts (FR-004) must be "the same distribution charts currently shown on the Holdings
  page". The frontend already computes the exact `EChartsOption` for those charts. Capturing an
  image from a second, off-screen ECharts instance fed the identical option object is a much
  smaller surface than reproducing chart computation and rendering server-side.
- Avoids adding a native canvas/headless-browser dependency to `apps/backend`'s Docker image
  (Constraints section) — the constitution's Stack Decision already accepts one native dependency
  (`better-sqlite3`); adding a second, heavier one (e.g. `skia-canvas`/`@napi-rs/canvas`, or a
  Chromium-based renderer) for a feature that has a much simpler in-browser option is not
  justified (Principle V, YAGNI).
- Principle II ("frontend MUST treat the API as the only path to data") is preserved: the frontend
  still never bypasses the API for _data_ — it fetches full feature datasets through the existing
  documented endpoints, exactly like the on-screen tables already do. Reformatting already-fetched
  data into a downloadable file is presentation, not a new data-access path.

**Alternatives considered**:

- _Backend generation with a new `/export` module_ — rejected: needs a duplicated/parallel
  translation mechanism (violates FR-006's "same mechanism" wording and Principle V), and needs
  server-side chart rendering (new native dependency, more moving parts) for no proportionate
  benefit, since the browser already has everything required.
- _Backend generation, frontend sends pre-resolved labels_ — rejected: pushes an ad hoc,
  per-request translation payload through the API for every export, which is more coupling than
  simply doing the whole transform where the translations and chart already live.

## 2. Format libraries

**Decision**: `exceljs` (browser build) for `.xlsx`, `pdfmake` (browser build) for PDF, `jszip`
for the full-export archive; CSV is hand-written (no dependency).

**Rationale**:

- `exceljs` is the de facto standard for building `.xlsx` with per-column types/formatting
  (needed to satisfy FR-003a's rationale — richer typed cells vs. plain CSV) and ships a browser
  bundle usable directly from Angular.
- `pdfmake` is a pure-JS, declarative PDF generator (document-definition object → PDF) with
  built-in table and image support, well suited to the fixed infobox+charts+table PDF layout in
  `design.md`, and needs no native/browser-automation dependency.
- `jszip` is the standard client-side ZIP library, sufficient for FR-010/FR-011's flat
  one-subdirectory-per-feature archive shape; streaming to disk (as `archiver` would give
  server-side) is not needed since the whole archive is built in memory and handed to the browser's
  download mechanism, well within SC-005's 30s budget for a typical account.
- CSV needs only RFC 4180 comma/quote/newline escaping (spec's Edge Cases) — a ~20-line function is
  simpler and has fewer moving parts than adding a dependency for it (Principle V, YAGNI).

**Alternatives considered**:

- `xlsx`/SheetJS community build — rejected in favor of `exceljs`: weaker per-cell styling API for
  the typed-column benefit FR-003a calls out, and the actively-maintained community SheetJS build
  has had licensing/CDN-distribution friction historically.
- `jspdf` (+ `jspdf-autotable`) for PDF — considered, but `pdfmake`'s declarative document-definition
  model maps more directly onto the fixed infobox/charts/table layout in `design.md` and needs less
  manual positioning code.
- Papaparse for CSV — rejected: only used for _parsing_ CSV elsewhere in the ecosystem; writing
  RFC 4180 CSV is simple enough not to justify a dependency here.

## 3. Chart image capture for the PDF

**Decision**: An off-screen, unattached `<div>` sized to the visible chart's dimensions, given a
fresh `echarts.init(...)`, fed the same `EChartsOption` the visible `EchartComponent` already
computes (via a small exported "get current chart option" seam on the existing distribution
component, or by recomputing the same signal used to render it), then `chart.getDataURL({type:
'png', pixelRatio: 2})` before `chart.dispose()`. The resulting data URL is embedded directly as a
`pdfmake` image node.

**Rationale**: Reuses the exact chart configuration already on screen (guarantees PDF charts match
the page, satisfying FR-004 literally), needs no new charting dependency (`echarts` is already a
frontend dependency), and keeps the capture step isolated behind one small function so it is easy
to mock in Jest tests that don't have a real canvas.

**Alternatives considered**: `html2canvas`-style DOM screenshot of the visible chart — rejected:
fragile (depends on exact pixel layout/scroll position, CSS, and needs the chart to actually be on
screen, which the full "Export my data" flow cannot guarantee since Settings has no charts
rendered) versus rendering fresh from the same option object, which works identically whether the
chart is currently visible or not.

## 4. Full "Export my data" data sourcing

**Decision**: The full-export flow calls each registered feature's existing full-list API
endpoint (the same one its own page uses) to obtain that feature's complete dataset, independent
of whether that feature's page is currently mounted.

**Rationale**: Keeps a single data-fetching path per feature (its existing API), avoids a new
aggregate backend endpoint, and composes directly with the `FeatureExportRegistry` — iterating the
registry and calling each entry's `fetchData()` (backed by its feature's `HttpClient` call) is what
lets FR-012 hold without bespoke per-feature wiring in the full-export code path.

**Alternatives considered**: A new backend `/export/all` aggregate endpoint that queries every
feature's repository in one request — rejected: would be the one new backend surface this feature
otherwise avoids (see §1), for a benefit (fewer HTTP round trips) that doesn't matter within
SC-005's 30s budget for a typical account.

## 5. Placeholder domains (Retirement, Insurances, Haushaltsplaner, Historic Wealth Development)

**Finding**: These four domains are UI placeholders today (`*-placeholder.component.ts`, no
backend module, no `docs/user-guide.md` section) — confirmed by inspecting
`libs/frontend/domain/{retirement,insurances,haushaltsplaner,historic-wealth-development}` and
`apps/backend/src` (only `holdings` and `account-overview` exist as real backend modules).

**Decision**: Each placeholder domain registers a `FeatureExportDefinition` now, with an empty
data provider (`fetchData()` resolves to zero rows) and column/label/infobox definitions written
against that domain's already-decided scope (per the constitution's Product Scope section) even
though no UI/data exists yet to populate them on screen.

**Rationale**: This directly satisfies FR-014 ("a feature with no data yet MUST still produce
valid, correctly structured... exports") for free — there is _no data_ rather than _zero rows of
otherwise-real data_, but the produced files are identical in shape either way. It also means
FR-012 is validated immediately: when Retirement (etc.) gets a real backend and data provider
later, only its `FeatureExportDefinition`'s `fetchData()` need change — the registry, control, and
generation code do not.

**Alternatives considered**: Deferring these four domains' registration entirely until each is
actually built — rejected: leaves US2/FR-009 ("the same Export control... on Account Overview,
Retirement, Insurances, Haushaltsplaner, and Wealth Development") unmet for this feature, and
those pages currently have no primary "Add" action to place the control next to either — see
`tasks.md` follow-up: each placeholder page needs the Export control added next to _some_ stable
anchor even before it has an "Add" action of its own (recommend: top-right of its placeholder
panel, same relative position the real "Add" action will later occupy).
