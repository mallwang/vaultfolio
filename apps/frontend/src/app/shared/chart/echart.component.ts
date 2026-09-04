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
import * as echarts from 'echarts';
import type { EChartsOption } from 'echarts';
import { ThemeService, type Theme } from '../../core/theme/theme.service';
import { resolveChartPalette, type ChartPalette } from './chart-palette';

/**
 * Thin standalone wrapper around ECharts' imperative `init`/`setOption`/
 * `resize`/`dispose` API (research.md #1) — the reusable, documented
 * pattern FR-009 requires for any chart in the app. See
 * `contracts/echart-component-api.md` for the full behavioral contract this
 * component implements: theming, responsiveness, localization (caller's
 * responsibility), loading, and lifecycle.
 */
@Component({
  selector: 'app-echart',
  imports: [],
  templateUrl: './echart.component.html',
  styleUrl: './echart.component.css',
})
export class EchartComponent implements AfterViewInit, OnChanges, OnDestroy {
  /** Caller-supplied, already-localized ECharts option (series, tooltip, legend, etc.). */
  @Input({ required: true }) option!: EChartsOption;

  /** When true, shows ECharts' built-in loading overlay instead of applying `option` (FR-007). */
  @Input() loading = false;

  @ViewChild('host', { static: true })
  private readonly hostRef!: ElementRef<HTMLDivElement>;

  private readonly themeService = inject(ThemeService);

  private instance: echarts.ECharts | undefined;
  private resizeObserver: ResizeObserver | undefined;

  constructor() {
    // FR-004: re-theme the live instance on every theme change without
    // requiring the caller to rebuild `option`.
    effect(() => {
      const theme = this.themeService.theme();
      this.applyThemeFragment(theme);
    });
  }

  ngAfterViewInit(): void {
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
