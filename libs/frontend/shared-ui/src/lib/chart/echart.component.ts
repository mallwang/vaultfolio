import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ViewChild,
  effect,
  inject,
} from '@angular/core';
import type * as EChartsNamespace from 'echarts';
type EChartsOption = EChartsNamespace.EChartsOption;
import { ThemeService, type Theme } from '../theme/theme.service';
import { resolveChartPalette, type ChartPalette } from './chart-palette';

/**
 * Module-level cache for the dynamic `import('echarts')` below, shared by
 * every `EchartComponent` instance. Without it, a page rendering several
 * tiles at once (e.g. the holdings page's 6 charts) fires that many
 * independent `import('echarts')` calls in the same change-detection pass —
 * wasteful once the chunk is already loaded, and in `@angular/build:unit-test`
 * specs that `vi.mock('echarts', ...)`, concurrent first-time dynamic
 * imports of the same specifier can race such that only the first actually
 * resolves to the mock. Caching the promise means every instance awaits the
 * exact same resolution.
 */
/** Payload of {@link EchartComponent.chartClick}. */
export interface EchartClickEvent {
  dataIndex: number;
  /** Category name of the clicked item (e.g. the x-axis label). */
  name: string;
  seriesName?: string;
}

/** Translucent slate: a recessive grid that reads on both the light and the dark card. */
const GRID_COLOR = 'rgba(148, 163, 184, 0.25)';

let echartsModulePromise: Promise<typeof EChartsNamespace> | undefined;

function loadEcharts(): Promise<typeof EChartsNamespace> {
  echartsModulePromise ??= import('echarts');
  return echartsModulePromise;
}

/**
 * Thin standalone wrapper around ECharts' imperative `init`/`setOption`/
 * `resize`/`dispose` API (research.md #1) — the reusable, documented
 * pattern FR-009 requires for any chart in the app. See
 * `contracts/echart-component-api.md` for the full behavioral contract this
 * component implements: theming, responsiveness, localization (caller's
 * responsibility), loading, and lifecycle.
 *
 * Loads the real `echarts` package via a dynamic `import()` inside
 * `ngAfterViewInit` rather than a top-level static import (020): `echarts`
 * declares itself as having side effects in its own `package.json`, so a
 * static import anywhere in `@vaultfolio/frontend-shared-ui`'s barrel would
 * force the whole ~1MB library into every consumer's bundle — including
 * app-shell chrome (`IconComponent`/`TranslatePipe`) that never renders a
 * chart — rather than only the routes that actually show one.
 */
@Component({
  selector: 'app-echart',
  imports: [],
  // Inline template/styles, not templateUrl/styleUrl (020) — see
  // IconComponent's identical note: `@angular/build:unit-test` externalizes
  // workspace-linked packages, leaving templateUrl/styleUrl unresolved at
  // test runtime.
  template: `<div class="echart-host" #host></div>`,
  styles: `
    /* No fixed pixel dimensions — the chart fills whatever card/container the
       caller places it in (contracts/echart-component-api.md Responsiveness
       guarantee); resizing is driven by the component's ResizeObserver. */
    :host {
      display: block;
      width: 100%;
      height: 100%;
    }

    .echart-host {
      width: 100%;
      height: 100%;
    }
  `,
})
export class EchartComponent implements AfterViewInit, OnChanges, OnDestroy {
  /** Caller-supplied, already-localized ECharts option (series, tooltip, legend, etc.). */
  @Input({ required: true }) option!: EChartsOption;

  /** When true, shows ECharts' built-in loading overlay instead of applying `option` (FR-007). */
  @Input() loading = false;

  /** A click on a data item (bar, point, …) — e.g. to open a detail view for that item. */
  @Output() readonly chartClick = new EventEmitter<EchartClickEvent>();

  @ViewChild('host', { static: true })
  private readonly hostRef!: ElementRef<HTMLDivElement>;

  private readonly themeService = inject(ThemeService);

  private instance: EChartsNamespace.ECharts | undefined;
  private resizeObserver: ResizeObserver | undefined;
  private resizeFrame = 0;

  constructor() {
    // FR-004: re-theme the live instance on every theme change without
    // requiring the caller to rebuild `option`.
    effect(() => {
      const theme = this.themeService.theme();
      this.applyThemeFragment(theme);
    });
  }

  ngAfterViewInit(): void {
    void loadEcharts().then((echarts) => {
      this.instance = echarts.init(this.hostRef.nativeElement);
      this.instance.on?.('click', (params) => {
        const p = params as { dataIndex: number; name: string; seriesName?: string };
        this.chartClick.emit({ dataIndex: p.dataIndex, name: p.name, seriesName: p.seriesName });
      });
      this.applyState();
      this.applyThemeFragment(this.themeService.theme());

      // Deferred to the next frame: resizing synchronously inside the callback can change the
      // observed box again, which the browser reports as "ResizeObserver loop completed with
      // undelivered notifications" (surfaced by GlobalErrorHandler as an app error).
      this.resizeObserver = new ResizeObserver(() => {
        cancelAnimationFrame(this.resizeFrame);
        this.resizeFrame = requestAnimationFrame(() => this.instance?.resize());
      });
      this.resizeObserver.observe(this.hostRef.nativeElement);
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.instance) {
      // Not yet created — the initial state is applied once inside ngAfterViewInit.
      return;
    }
    if (changes['loading'] || changes['option']) {
      this.applyState();
    }
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    cancelAnimationFrame(this.resizeFrame);
    this.instance?.dispose();
  }

  private applyState(): void {
    if (!this.instance) {
      return;
    }
    if (this.loading) {
      const palette = resolveChartPalette(this.themeService.theme());
      this.instance.showLoading('default', {
        textColor: palette.textColor,
        maskColor: palette.backgroundColor,
      });
      return;
    }
    this.instance.hideLoading();
    this.instance.setOption(this.option, true);
    // `notMerge` replaced the whole option, theme fragment included — re-apply it.
    this.applyThemeFragment(this.themeService.theme());
  }

  private applyThemeFragment(theme: Theme): void {
    if (!this.instance) {
      return;
    }
    this.instance.setOption(EchartComponent.themeOptionFragment(resolveChartPalette(theme)));
  }

  private static themeOptionFragment(palette: ChartPalette): EChartsOption {
    return {
      color: palette.seriesColors,
      textStyle: { color: palette.textColor },
      // Legend text has its own fixed-gray default (ECharts' `LegendModel`
      // sets `textStyle.color` itself rather than falling back to the root
      // `textStyle` above), so it doesn't pick up the theme unless set
      // explicitly here — same reason the pie's pointer labels needed
      // their own color (holdings-distribution.component.ts).
      legend: { textStyle: { color: palette.textColor } },
      // Axis labels likewise default to a fixed gray (#6E7079) that is unreadable on the dark card.
      xAxis: { axisLabel: { color: palette.textColor } },
      yAxis: {
        axisLabel: { color: palette.textColor },
        splitLine: { lineStyle: { color: GRID_COLOR } },
      },
      tooltip: {
        backgroundColor: palette.backgroundColor,
        textStyle: { color: palette.textColor },
      },
    };
  }
}
