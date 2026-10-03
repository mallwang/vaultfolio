import { HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { ExportRow, FeatureExportDefinition } from '@vaultfolio/export';
import type { RetirementPensionFigures, RetirementRecord } from '@vaultfolio/api-contract';
import { I18nService } from '@vaultfolio/frontend-shared-ui';
import { expectedMonthlyOf, guaranteedMonthlyOf, sum } from '@vaultfolio/retirement';
import { RetirementService } from './retirement.service';

/** Own plus employer monthly contributions (supplement first, as in the summary). */
function contribution(record: RetirementRecord): string | null {
  if (record.pillar === 'STATUTORY') return null;
  const figures = record.figures as RetirementPensionFigures;
  const own = record.supplement?.contributionMonthly ?? figures.contributionMonthly;
  const employer =
    record.supplement?.employerContributionMonthly ?? figures.employerContributionMonthly;
  return own === undefined && employer === undefined ? null : sum([own, employer]);
}

/**
 * Retirement's `FeatureExportDefinition` (FR-019): one row per record with the owner's own figures
 * for PDF, Excel, CSV and JSON. Registered in `apps/frontend/src/app/export/feature-export.registry.ts`.
 * "Export my data" iterates every registered feature regardless of entitlement or key state, so a
 * member without the domain (403) or an instance without a key (503) gets empty output instead of
 * a failure.
 */
export function createRetirementExportDefinition(): FeatureExportDefinition {
  const api = inject(RetirementService);
  const i18n = inject(I18nService);

  const toRow = (record: RetirementRecord): ExportRow => ({
    pillar: i18n.translate(`retirement.pillars.${record.pillar.toLowerCase()}`),
    type: i18n.translate(`retirement.types.${record.contractType}`),
    provider: record.providerLabel,
    number: record.identifier,
    guaranteed: guaranteedMonthlyOf(record) ?? null,
    expected: expectedMonthlyOf(record) ?? null,
    contribution: contribution(record),
    payoutStart: record.payoutStart,
    statementDate: record.statementDate,
    origin: i18n.translate(
      record.origin === 'IMPORTED' ? 'retirement.badges.imported' : 'retirement.badges.manual',
    ),
  });

  return {
    featureId: 'retirement',
    titleKey: 'retirementExport.title',
    infoboxKey: 'retirementExport.infobox',
    columns: [
      { key: 'pillar', labelKey: 'retirementExport.columnPillar', format: 'text' },
      { key: 'type', labelKey: 'retirementExport.columnType', format: 'text' },
      { key: 'provider', labelKey: 'retirementExport.columnProvider', format: 'text' },
      { key: 'number', labelKey: 'retirementExport.columnNumber', format: 'text' },
      { key: 'guaranteed', labelKey: 'retirementExport.columnGuaranteed', format: 'currency' },
      { key: 'expected', labelKey: 'retirementExport.columnExpected', format: 'currency' },
      { key: 'contribution', labelKey: 'retirementExport.columnContribution', format: 'currency' },
      { key: 'payoutStart', labelKey: 'retirementExport.columnPayoutStart', format: 'date' },
      { key: 'statementDate', labelKey: 'retirementExport.columnStatementDate', format: 'date' },
      { key: 'origin', labelKey: 'retirementExport.columnOrigin', format: 'text' },
    ],
    async fetchData(): Promise<ExportRow[]> {
      try {
        return (await firstValueFrom(api.records())).map(toRow);
      } catch (error) {
        if (error instanceof HttpErrorResponse && (error.status === 403 || error.status === 503)) {
          return [];
        }
        throw error;
      }
    },
  };
}
