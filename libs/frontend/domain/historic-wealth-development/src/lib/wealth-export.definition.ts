import { HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import type {
  EChartsOption,
  ExportRow,
  ExportTable,
  FeatureExportDefinition,
  PdfSection,
} from '@vaultfolio/export';
import type { WealthSettings, WealthSnapshot } from '@vaultfolio/api-contract';
import { I18nService, resolveChartPalette } from '@vaultfolio/frontend-shared-ui';
import { filterPeriod, sortedByDate } from '@vaultfolio/wealth';
import { firstValueFrom } from 'rxjs';
import {
  classLabels,
  wealthChartColors,
  wealthChartOption,
  type WealthChartFormat,
} from './charts/wealth-charts';
import { formatDate, formatMoney } from './wealth-format';
import {
  buildWealthExportTables,
  buildWealthPdfSections,
  emptyWealthPdfSections,
} from './wealth-report';
import { WealthStore } from './wealth-store';
import { WealthService } from './wealth.service';

interface Source {
  snapshots: WealthSnapshot[];
  settings: WealthSettings;
}

/**
 * Wealth's `FeatureExportDefinition` (029 capability, FR-015), registered in
 * `apps/frontend/src/app/export/feature-export.registry.ts`. The PDF sections, the chart and the
 * CSV/Excel/JSON tables are projections of the same snapshots through `@vaultfolio/wealth`, so
 * every format shows the same figures as the screen. The PDF follows the period filter; the data
 * formats always carry every snapshot. "Export my data" iterates every registered feature
 * regardless of entitlement, so a member without the domain (403) or an unavailable domain (503)
 * gets empty output instead of a failure.
 */
export function createWealthExportDefinition(): FeatureExportDefinition {
  const api = inject(WealthService);
  const store = inject(WealthStore);
  const i18n = inject(I18nService);
  // Snapshots of the last `getPdfSections()` call; the PDF chart reads them right after.
  let inPeriod: readonly WealthSnapshot[] = [];

  /** Every snapshot and the settings of the caller; `null` for 403/503. */
  const load = async (): Promise<Source | null> => {
    try {
      const [snapshots, settings] = await Promise.all([
        firstValueFrom(api.snapshots()),
        firstValueFrom(api.settings()),
      ]);
      return { snapshots, settings };
    } catch (error) {
      if (error instanceof HttpErrorResponse && (error.status === 403 || error.status === 503)) {
        return null;
      }
      throw error;
    }
  };

  const chart = (): EChartsOption[] => {
    if (inPeriod.length === 0) return [];
    const lang = i18n.language();
    const t = (key: string) => i18n.translate(key);
    const sorted = sortedByDate(inPeriod);
    const format: WealthChartFormat = {
      money: (v) => formatMoney(v.toFixed(2), lang),
      moneyWhole: (v) => formatMoney(String(v), lang, { whole: true }),
      date: (iso) => formatDate(iso, lang),
    };
    // The PDF is always printed on white, whatever theme the app is in.
    const option = wealthChartOption(
      sorted,
      classLabels(sorted, (id) => t(`wealth.classes.${id}`)),
      { net: t('wealth.chart.net'), liabilities: t('wealth.chart.liabilities') },
      format,
      wealthChartColors('light'),
    ) as EChartsOption;
    const text = resolveChartPalette('light').textColor;
    return [
      {
        ...option,
        title: {
          text: t('wealth.export.chartTitle'),
          left: 0,
          top: 0,
          textStyle: { fontSize: 14, color: text },
        },
        legend: { ...option['legend'], left: undefined, right: 0, type: 'plain' },
      },
    ];
  };

  return {
    featureId: 'historic-wealth-development',
    titleKey: 'wealth.export.title',
    infoboxKey: 'wealth.export.infobox',
    pdfInfoboxKey: 'wealth.export.pdfInfobox',
    formatDataKeys: {
      pdf: 'wealth.export.data.pdf',
      xlsx: 'wealth.export.data.xlsx',
      csv: 'wealth.export.data.csv',
      json: 'wealth.export.data.json',
    },
    columns: [],
    fetchData: (): Promise<ExportRow[]> => Promise.resolve([]),
    // Enabled until the page has loaded and shows there is nothing to export.
    isEnabled: () => !store.loaded() || store.snapshots().length > 0,
    disabledTooltipKey: 'wealth.export.unavailable',
    async getPdfSections(): Promise<PdfSection[]> {
      inPeriod = [];
      const t = (key: string) => i18n.translate(key);
      const source = await load();
      if (!source || source.snapshots.length === 0) return emptyWealthPdfSections(t);
      inPeriod = filterPeriod(source.snapshots, store.period());
      return buildWealthPdfSections(inPeriod, source.settings, store.period(), t, i18n.language());
    },
    async getExportTables(): Promise<ExportTable[]> {
      const source = await load();
      return buildWealthExportTables(
        source?.snapshots ?? [],
        source?.settings ?? { classGroups: [] },
        (key) => i18n.translate(key),
      );
    },
    // The chart spans the page width in the PDF, so it is captured in a matching wide format.
    pdfChartSize: { width: 1000, height: 230 },
    getChartOptions: chart,
  };
}
