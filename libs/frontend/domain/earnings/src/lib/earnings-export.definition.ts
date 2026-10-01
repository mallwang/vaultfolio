import { HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import type { ExportColumn, ExportRow, FeatureExportDefinition } from '@vaultfolio/export';
import type { EarningsRecordDetail } from '@vaultfolio/api-contract';
import { I18nService } from '@vaultfolio/frontend-shared-ui';
import { firstValueFrom } from 'rxjs';
import { EarningsService } from './earnings.service';

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

  return {
    featureId: 'earnings',
    titleKey: 'earnings.export.title',
    infoboxKey: 'earnings.export.infobox',
    columns: COLUMNS,
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
