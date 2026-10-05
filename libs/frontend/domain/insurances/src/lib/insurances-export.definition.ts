import { HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import type {
  EChartsOption,
  ExportRow,
  ExportTable,
  FeatureExportDefinition,
  PdfSection,
} from '@vaultfolio/export';
import { I18nService, resolveChartPalette } from '@vaultfolio/frontend-shared-ui';
import { firstValueFrom } from 'rxjs';
import { breakdownChartOption, insurancesChartColors } from './charts/insurances-charts';
import { fill, formatMoney } from './insurances-format';
import { buildInsurancesExportTables } from './insurances-export-tables';
import { buildInsurancesPdfSections, buildInsurancesReport } from './insurances-pdf-sections';
import type { GroupBreakdown } from './insurances-view';
import { InsurancesService } from './insurances.service';

/**
 * Insurances' `FeatureExportDefinition` (029 capability, FR-017). The PDF sections and the
 * JSON/CSV/Excel tables are projections of the same report: key figures, cost per group, every
 * contract and the gap check. "Export my data" iterates every registered feature regardless of
 * entitlement, so a member without the domain (403) or an unavailable domain (503) gets empty
 * output.
 */
export function createInsurancesExportDefinition(): FeatureExportDefinition {
  const api = inject(InsurancesService);
  const i18n = inject(I18nService);
  // Breakdown of the last `getPdfSections()` call; the PDF chart reads it right after.
  let breakdown: GroupBreakdown[] = [];

  const chart = (): EChartsOption[] => {
    if (breakdown.length === 0) return [];
    const lang = i18n.language();
    const text = resolveChartPalette('light').textColor;
    const option = breakdownChartOption(
      breakdown,
      (group) => i18n.translate(`insurances.groups.${group}`),
      {
        money: (v) => formatMoney(v.toFixed(2), lang),
        moneyWhole: (v) => formatMoney(String(v), lang, true),
      },
      // The PDF is always printed on white, whatever theme the app is in.
      insurancesChartColors('light'),
    ) as EChartsOption;
    return [
      {
        ...option,
        title: {
          text: i18n.translate('insurances.chart.groupTitle'),
          left: 0,
          top: 0,
          textStyle: { fontSize: 14, color: text },
        },
        grid: { left: 8, right: 48, top: 36, bottom: 8, containLabel: true },
      },
    ];
  };

  return {
    featureId: 'insurances',
    titleKey: 'insurances.export.title',
    infoboxKey: 'insurances.export.infobox',
    pdfInfoboxKey: 'insurances.export.pdfInfobox',
    formatDataKeys: {
      pdf: 'insurances.export.data.pdf',
      xlsx: 'insurances.export.data.xlsx',
      csv: 'insurances.export.data.csv',
      json: 'insurances.export.data.json',
    },
    pdfChartSize: { width: 1000, height: 220 },
    getChartOptions: chart,
    async getPdfSections(): Promise<PdfSection[]> {
      breakdown = [];
      try {
        const data = await firstValueFrom(api.data());
        const t = (key: string, params?: Record<string, string | number>) =>
          fill(i18n.translate(key), params);
        const report = buildInsurancesReport(data, t);
        breakdown = report.breakdown;
        return buildInsurancesPdfSections(report, t, i18n.language());
      } catch (error) {
        if (error instanceof HttpErrorResponse && (error.status === 403 || error.status === 503)) {
          return [];
        }
        throw error;
      }
    },
    // The data formats are served by `getExportTables`; there is no generic row table.
    columns: [],
    fetchData: (): Promise<ExportRow[]> => Promise.resolve([]),
    async getExportTables(): Promise<ExportTable[]> {
      try {
        const data = await firstValueFrom(api.data());
        const t = (key: string, params?: Record<string, string | number>) =>
          fill(i18n.translate(key), params);
        return buildInsurancesExportTables(buildInsurancesReport(data, t), t);
      } catch (error) {
        if (error instanceof HttpErrorResponse && (error.status === 403 || error.status === 503)) {
          return [];
        }
        throw error;
      }
    },
  };
}
