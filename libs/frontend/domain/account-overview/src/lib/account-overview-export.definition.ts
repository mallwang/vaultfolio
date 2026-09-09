import { inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import type { FeatureExportDefinition, ExportRow } from '@vaultfolio/export';
import type { AccountOverviewEntry } from '@vaultfolio/api-contract';
import { I18nService } from '@vaultfolio/frontend-shared-ui';
import { AccountOverviewService } from './account-overview.service';

function toRow(entry: AccountOverviewEntry, i18n: I18nService): ExportRow {
  return {
    name: entry.name,
    category: i18n.translate(`accountCategory.${entry.category}`),
    status: i18n.translate(`accountStatus.${entry.status}`),
    provider: entry.provider,
    website: entry.website,
    purpose: entry.purpose,
    cardUsage: entry.cardUsage,
    requiredMinimum: entry.requiredMinimum,
    cardNumber: entry.cardNumber,
    validUntil: entry.validUntil,
    notes: entry.notes,
  };
}

/**
 * Account Overview's `FeatureExportDefinition` (US2, FR-008/FR-009): registered in
 * `apps/frontend/src/app/export/feature-export.registry.ts`. `columns` covers every field
 * `AccountOverviewPageComponent` renders per account row. No `getChartOptions` — Account
 * Overview has no charts (data-model.md).
 */
export function createAccountOverviewExportDefinition(): FeatureExportDefinition {
  const accountOverviewService = inject(AccountOverviewService);
  const i18n = inject(I18nService);
  const accounts = toSignal(accountOverviewService.list(), {
    initialValue: [] as AccountOverviewEntry[],
  });

  return {
    featureId: 'account-overview',
    titleKey: 'accountOverviewExport.title',
    infoboxKey: 'accountOverviewExport.infobox',
    columns: [
      { key: 'name', labelKey: 'accountOverviewExport.columnName', format: 'text' },
      { key: 'category', labelKey: 'accountOverviewExport.columnCategory', format: 'text' },
      { key: 'status', labelKey: 'accountOverviewExport.columnStatus', format: 'text' },
      { key: 'provider', labelKey: 'accountOverviewExport.columnProvider', format: 'text' },
      { key: 'website', labelKey: 'accountOverviewExport.columnWebsite', format: 'text' },
      { key: 'purpose', labelKey: 'accountOverviewExport.columnPurpose', format: 'text' },
      { key: 'cardUsage', labelKey: 'accountOverviewExport.columnCardUsage', format: 'text' },
      {
        key: 'requiredMinimum',
        labelKey: 'accountOverviewExport.columnRequiredMinimum',
        format: 'decimal',
      },
      { key: 'cardNumber', labelKey: 'accountOverviewExport.columnCardNumber', format: 'text' },
      { key: 'validUntil', labelKey: 'accountOverviewExport.columnValidUntil', format: 'text' },
      { key: 'notes', labelKey: 'accountOverviewExport.columnNotes', format: 'text' },
    ],
    isEnabled: () => accounts().length > 0,
    disabledTooltipKey: 'export.tooltipNoData',
    async fetchData(): Promise<ExportRow[]> {
      const rows = await firstValueFrom(accountOverviewService.list());
      return rows.map((entry) => toRow(entry, i18n));
    },
  };
}
