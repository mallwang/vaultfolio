import { HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import type {
  EChartsOption,
  ExportColumn,
  ExportRow,
  FeatureExportDefinition,
  PdfSection,
} from '@vaultfolio/export';
import type { EarningsRecordDetail, YearlyPoint } from '@vaultfolio/api-contract';
import {
  I18nService,
  resolveChartPalette,
  resolveEarningsSeriesColors,
} from '@vaultfolio/frontend-shared-ui';
import { firstValueFrom } from 'rxjs';
import { buildEarningsPdfSections, emptyEarningsPdfSections } from './earnings-pdf-sections';
import { formatMoney, formatMonth, formatPercent } from './earnings-format';
import { EarningsService } from './earnings.service';
import { fitChartToYearCount, grossPerYearOption } from './overview/charts/earnings-charts';

const AMOUNT_COLUMNS: [key: string, labelKey: string, summable?: boolean][] = [
  ['gross', 'earnings.terms.grossTotal', true],
  ['bonus', 'earnings.terms.bonusOneOff', true],
  ['taxGross', 'earnings.terms.taxGross'],
  ['svGrossKv', 'earnings.terms.svGrossKv'],
  ['svGrossRv', 'earnings.terms.svGrossRv'],
  ['wageTax', 'earnings.terms.wageTax', true],
  ['soli', 'earnings.terms.soli', true],
  ['churchTax', 'earnings.terms.churchTax', true],
  ['health', 'earnings.terms.health', true],
  ['care', 'earnings.terms.care', true],
  ['pension', 'earnings.terms.pension', true],
  ['unemployment', 'earnings.terms.unemployment', true],
  ['net', 'earnings.terms.statutoryNet', true],
  ['other', 'earnings.terms.other', true],
  ['payout', 'earnings.terms.payout', true],
];

const COLUMNS: ExportColumn[] = [
  { key: 'employer', labelKey: 'earnings.export.columnEmployer', format: 'text' },
  { key: 'period', labelKey: 'earnings.export.columnPeriod', format: 'text' },
  { key: 'issued', labelKey: 'earnings.export.columnIssued', format: 'text' },
  { key: 'kind', labelKey: 'earnings.export.columnKind', format: 'text' },
  ...AMOUNT_COLUMNS.map(([key, labelKey, summable]) => ({
    key,
    labelKey,
    format: 'currency' as const,
    ...(summable ? { summable } : {}),
  })),
  { key: 'source', labelKey: 'earnings.export.columnSource', format: 'text' },
  { key: 'corrected', labelKey: 'earnings.export.columnCorrected', format: 'text' },
];

/** One export row per payslip section, amounts as their canonical decimal strings (FR-017). */
export function toExportRow(record: EarningsRecordDetail, kindLabel: string): ExportRow {
  const a = record.amounts;
  return {
    employer: record.employerLabel,
    period: record.period,
    issued: record.issued,
    kind: kindLabel,
    gross: a.gross,
    bonus: a.oneOff.gross ?? '0.00',
    taxGross: a.taxGross,
    svGrossKv: a.svGrossKv,
    svGrossRv: a.svGrossRv,
    wageTax: a.wageTax,
    soli: a.soli,
    churchTax: a.churchTax,
    health: a.health,
    care: a.care,
    pension: a.pension,
    unemployment: a.unemployment,
    net: a.net,
    other: a.other,
    payout: a.payout,
    source: record.import.fileName,
    // names of figures the user corrected in the import preview (FR-012a), never values
    corrected: (a.corrected ?? []).join(', '),
  };
}

/**
 * Earnings' `FeatureExportDefinition` (029 capability, FR-040), registered in
 * `apps/frontend/src/app/export/feature-export.registry.ts`: every stored record of the caller,
 * oldest first. "Export my data" iterates every registered feature regardless of entitlement, so a
 * member without the Earnings domain (403) gets an empty table instead of a failure.
 */
export function createEarningsExportDefinition(): FeatureExportDefinition {
  const api = inject(EarningsService);
  const i18n = inject(I18nService);
  // Yearly series of the last `getPdfSections()` call; the PDF chart reads it right after.
  let yearly: readonly YearlyPoint[] = [];

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
    columns: COLUMNS,
    async getPdfSections(): Promise<PdfSection[]> {
      yearly = [];
      const t = (key: string) => i18n.translate(key);
      try {
        // No employer filter: the PDF always covers the whole career, whatever is set on screen.
        const [overview, tables] = await Promise.all([
          firstValueFrom(api.overview()),
          firstValueFrom(api.tables()),
        ]);
        yearly = overview.hasData ? overview.yearly : [];
        return buildEarningsPdfSections(overview, tables, t, i18n.language());
      } catch (error) {
        if (error instanceof HttpErrorResponse && error.status === 403)
          return emptyEarningsPdfSections(t);
        throw error;
      }
    },
    // The chart spans the page width in the PDF, so it is captured in a matching wide format.
    pdfChartSize: { width: 1000, height: 330 },
    getChartOptions: grossChart,
    async fetchData(): Promise<ExportRow[]> {
      try {
        const records = await firstValueFrom(api.records());
        return [...records]
          .sort(
            (x, y) =>
              x.period.localeCompare(y.period) || x.issued.localeCompare(y.issued) || x.seq - y.seq,
          )
          .map((r) => toExportRow(r, i18n.translate(`earnings.kind.${r.kind}`)));
      } catch (error) {
        if (error instanceof HttpErrorResponse && error.status === 403) return [];
        throw error;
      }
    },
  };
}
