import {
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ViewChild,
  effect,
  inject,
} from '@angular/core';
import type * as EChartsNamespace from 'echarts';
import type { EChartsOption } from 'echarts';
import { ThemeService, type Theme } from '../theme/theme.service';
import { resolveChartPalette, type ChartPalette } from './chart-palette';

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

  @ViewChild('host', { static: true })
  private readonly hostRef!: ElementRef<HTMLDivElement>;

  private readonly themeService = inject(ThemeService);

  private instance: EChartsNamespace.ECharts | undefined;
  private resizeObserver: ResizeObserver | undefined;

  constructor() {
    // FR-004: re-theme the live instance on every theme change without
    // requiring the caller to rebuild `option`.
    effect(() => {
      const theme = this.themeService.theme();
      this.applyThemeFragment(theme);
    });
  }

  async ngAfterViewInit(): Promise<void> {
    const echarts = await import('echarts');
    this.instance = echarts.init(this.hostRef.nativeElement);
    this.applyState();
    this.applyThemeFragment(this.themeService.theme());

    this.resizeObserver = new ResizeObserver(() => this.instance?.resize());
    this.resizeObserver.observe(this.hostRef.nativeElement);
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
      tooltip: {
        backgroundColor: palette.backgroundColor,
        textStyle: { color: palette.textColor },
      },
    };
  }
}
