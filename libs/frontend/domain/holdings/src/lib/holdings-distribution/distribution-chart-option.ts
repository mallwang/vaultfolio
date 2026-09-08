import type { EChartsOption } from 'echarts';
import type { AssetType } from '@vaultfolio/api-contract';
import { ASSET_TYPE_COLORS } from '@vaultfolio/frontend-shared-ui';

/**
 * Picks black or white for a segment's inside label based on the fill
 * color's perceived brightness (YIQ formula), so plain text — no
 * border/glow — stays legible against every fixed `ASSET_TYPE_COLORS`
 * value, including the light gold "precious metal" slice.
 */
export function contrastTextColor(hexColor: string): string {
  const r = Number.parseInt(hexColor.slice(1, 3), 16);
  const g = Number.parseInt(hexColor.slice(3, 5), 16);
  const b = Number.parseInt(hexColor.slice(5, 7), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 150 ? '#1f2937' : '#ffffff';
}

/** data-model.md "Holdings Distribution Chart Entry (revised)" — one aggregate per `AssetType`. */
export interface HoldingsDistributionEntry {
  /** The sole grouping key — also drives the slice's fixed color (`ASSET_TYPE_COLORS`). */
  assetType: AssetType;
  /** Decimal total, converted via `.toNumber()` at the presentation boundary only. */
  value: number;
}

/**
 * Pure chart-option builder (no Angular import beyond plain constants), kept in its own,
 * framework-thin file — deliberately NOT colocated with `HoldingsDistributionComponent` — so
 * `holdings-export.definition.ts`'s PDF chart-image capture (029-export-data, research.md §3) can
 * import this one pure function without pulling `HoldingsDistributionComponent`'s `@Component`
 * class (and its own eagerly-bundled dependency chain) into whatever bundle imports the export
 * definition — see holdings-export.definition.ts's doc comment for why that distinction matters.
 */
export function buildDistributionChartOption(
  entries: HoldingsDistributionEntry[],
  locale: string,
  resolveName: (entry: HoldingsDistributionEntry) => string,
): EChartsOption {
  const fmt = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 2,
  });
  const pieCenter: [string, string] = ['50%', '42%'];
  return {
    // `EchartComponent`'s shared theming fragment merges in its own
    // `legend: { textStyle }` on every theme change (to keep legend text
    // readable for charts that DO show one) — since that's a merge, not a
    // replace, it would otherwise resurrect a default-visible legend here
    // even though this option has no `legend` key of its own. Explicit
    // `show: false` survives that merge.
    legend: { show: false },
    tooltip: {
      trigger: 'item',
      formatter: (params: unknown) => {
        const p = params as { name: string; value: number; percent: number };
        return `${p.name}: ${fmt.format(p.value)} (${p.percent}%)`;
      },
    },
    series: [
      {
        type: 'pie',
        radius: ['40%', '65%'],
        center: pieCenter,
        padAngle: 2,
        itemStyle: { borderRadius: 9 },
        // Name is redundant with the legend and would otherwise get
        // clipped for longer localized asset-type labels in this small a
        // chart — percentage only avoids that entirely. Placed inside
        // each segment (vs. the previous outside label + pointer line)
        // so there's no separate `labelLine` to configure or clip. Each
        // data point overrides `label.color` below with whichever of
        // black/white contrasts with its own fixed `ASSET_TYPE_COLORS`
        // fill (a single series-level color can't stay legible against
        // both the light gold "precious metal" slice and the darker
        // ones) — plain, no text border/glow. One decimal place keeps
        // the label short enough to fit even the narrowest segment. A
        // smaller-than-default fontSize keeps the label legible inside
        // even the narrowest slices instead of overflowing them.
        label: { position: 'inside', formatter: '{d}%', fontWeight: 'bold', fontSize: 10 },
        labelLine: { show: false },
        percentPrecision: 1,
        data: entries.map((entry) => {
          const color = ASSET_TYPE_COLORS[entry.assetType];
          return {
            name: resolveName(entry),
            value: entry.value,
            itemStyle: { color },
            label: { color: contrastTextColor(color) },
          };
        }),
      },
    ],
  };
}
