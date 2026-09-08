import { InjectionToken } from '@angular/core';
import type * as EChartsNamespace from 'echarts';
type EChartsOption = EChartsNamespace.EChartsOption;

/**
 * research.md §3: renders `option` in a fresh, off-screen, unattached `echarts.init` instance —
 * sized to match the on-screen chart's aspect ratio — and captures it as a PNG data URL, then
 * disposes the instance. Works identically whether or not the source chart is currently mounted
 * (the full "Export my data" flow has no charts on screen at all), because it never reads from
 * the visible DOM — only from the same `EChartsOption` object the visible chart already computed.
 */
export async function captureChartImage(option: EChartsOption): Promise<string> {
  const echarts = await import('echarts');

  const host = document.createElement('div');
  host.style.position = 'fixed';
  host.style.left = '-10000px';
  host.style.top = '0';
  host.style.width = '640px';
  host.style.height = '400px';
  document.body.appendChild(host);

  const instance = echarts.init(host, undefined, { renderer: 'canvas' });
  try {
    instance.setOption(option, true);
    return instance.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#ffffff' });
  } finally {
    instance.dispose();
    host.remove();
  }
}

/**
 * Injectable seam (contracts/export-lib.md, tasks.md T018) so `ExportControlComponent`'s unit
 * tests can substitute a fast, canvas-free mock instead of exercising real ECharts/canvas in
 * `jsdom` — defaults to `captureChartImage` in production via `providedIn: 'root'`.
 */
export const CHART_IMAGE_CAPTURE = new InjectionToken<(option: EChartsOption) => Promise<string>>(
  'CHART_IMAGE_CAPTURE',
  { providedIn: 'root', factory: () => captureChartImage },
);
