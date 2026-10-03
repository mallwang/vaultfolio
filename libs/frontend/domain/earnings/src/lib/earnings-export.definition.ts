import { HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import type {
  EChartsOption,
  ExportRow,
  ExportTable,
  FeatureExportDefinition,
  PdfSection,
} from '@vaultfolio/export';
import type { EarningsOverview, EarningsTables, YearlyPoint } from '@vaultfolio/api-contract';
import {
  I18nService,
  resolveChartPalette,
  resolveEarningsSeriesColors,
} from '@vaultfolio/frontend-shared-ui';
import { firstValueFrom } from 'rxjs';
import { toExportTables } from './earnings-export-tables';
import { buildEarningsPdfSections, emptyEarningsPdfSections } from './earnings-pdf-sections';
import { buildEarningsReport, emptyEarningsReport } from './earnings-report';
import { formatMoney, formatMonth, formatPercent } from './earnings-format';
import { EarningsService } from './earnings.service';
import { fitChartToYearCount, grossPerYearOption } from './overview/charts/earnings-charts';

/**
 * Earnings' `FeatureExportDefinition` (029 capability, FR-040), registered in
 * `apps/frontend/src/app/export/feature-export.registry.ts`. The PDF sections and the CSV/Excel/
 * JSON tables are two projections of one report built from the overview and tables read models, so
 * every format shows the same figures as the screen (035). "Export my data" iterates every
 * registered feature regardless of entitlement, so a member without the Earnings domain (403) gets
 * empty output instead of a failure.
 */
export function createEarningsExportDefinition(): FeatureExportDefinition {
  const api = inject(EarningsService);
  const i18n = inject(I18nService);
  // Yearly series of the last `getPdfSections()` call; the PDF chart reads it right after.
  let yearly: readonly YearlyPoint[] = [];

  /** Overview and tables of the whole career (no employer filter); `null` for a 403. */
  const load = async (): Promise<{
    overview: EarningsOverview;
    tables: EarningsTables;
  } | null> => {
    try {
      const [overview, tables] = await Promise.all([
        firstValueFrom(api.overview()),
        firstValueFrom(api.tables()),
      ]);
      return { overview, tables };
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status === 403) return null;
      throw error;
    }
  };

  const grossChart = (): EChartsOption[] => {
    if (yearly.length === 0) return [];
    const lang = i18n.language();
    const t = (key: string) => i18n.translate(key);
    // The PDF is always printed on white, whatever theme the app is in.
    const option = grossPerYearOption(
      yearly,
      'total',
      { ...resolveEarningsSeriesColors('light'), text: resolveChartPalette('light').textColor },
      {
        regular: t('earnings.terms.regular'),
        bonus: t('earnings.terms.bonusOneOff'),
        net: t('earnings.terms.net'),
        taxes: t('earnings.terms.taxes'),
        social: t('earnings.terms.social'),
        bonusMonth: t('earnings.overview.bonusMonth'),
        employerChange: t('earnings.overview.employerChange'),
      },
      {
        money: (v) => formatMoney(v.toFixed(2), lang),
        moneyWhole: (v) => formatMoney(String(v), lang, { whole: true }),
        percent: (v) => formatPercent(v, lang),
        month: (p) => formatMonth(p, lang),
      },
    ) as EChartsOption;
    // Heading on the left, legend moved to the right so they do not overlap.
    return [
      {
        ...fitChartToYearCount(option, yearly.length),
        title: {
          text: t('earnings.overview.grossPerYear'),
          left: 0,
          top: 0,
          textStyle: { fontSize: 14, color: resolveChartPalette('light').textColor },
        },
        legend: { ...option['legend'], left: undefined, right: 0 },
      },
    ];
  };

  return {
    featureId: 'earnings',
    titleKey: 'earnings.export.title',
    infoboxKey: 'earnings.export.infobox',
    // The PDF shows sections (035) instead of the per-payslip table, so it needs its own text.
    pdfInfoboxKey: 'earnings.export.pdfInfobox',
    // Per-payslip rows are retired (035); the formats are served by `getExportTables`/`getPdfSections`.
    columns: [],
    fetchData: async (): Promise<ExportRow[]> => [],
    async getPdfSections(): Promise<PdfSection[]> {
      yearly = [];
      const t = (key: string) => i18n.translate(key);
      const source = await load();
      if (!source) return emptyEarningsPdfSections(t);
      yearly = source.overview.hasData ? source.overview.yearly : [];
      return buildEarningsPdfSections(source.overview, source.tables, t, i18n.language());
    },
    async getExportTables(): Promise<ExportTable[]> {
      const source = await load();
      const report = source
        ? buildEarningsReport(source.overview, source.tables)
        : emptyEarningsReport();
      return toExportTables(report, (key) => i18n.translate(key), i18n.language());
    },
    // The chart spans the page width in the PDF, so it is captured in a matching wide format.
    pdfChartSize: { width: 1000, height: 330 },
    getChartOptions: grossChart,
  };
}
