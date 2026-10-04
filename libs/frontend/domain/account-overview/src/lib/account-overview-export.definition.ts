import { inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import type { FeatureExportDefinition, ExportRow, PdfSection } from '@vaultfolio/export';
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
 * One printable table for the PDF: a portrait A4 page cannot hold all eleven columns, so the
 * secondary fields (website, card usage/number, validity, notes) are stacked into one wrapping
 * "Details" cell instead of getting a column each.
 */
function toPdfSection(entries: AccountOverviewEntry[], i18n: I18nService): PdfSection {
  const label = (key: string) => i18n.translate(`accountOverviewExport.${key}`);
  const details = (entry: AccountOverviewEntry) =>
    [
      entry.website,
      entry.cardUsage && `${label('columnCardUsage')}: ${entry.cardUsage}`,
      entry.cardNumber && `${label('columnCardNumber')}: ${entry.cardNumber}`,
      entry.validUntil && `${label('columnValidUntil')}: ${entry.validUntil}`,
      entry.notes && `${label('columnNotes')}: ${entry.notes}`,
    ]
      .filter(Boolean)
      .join('\n');

  return {
    kind: 'table',
    title: i18n.translate('accountOverviewExport.title'),
    startOnNewPage: false,
    fontSize: 7.5,
    columns: [
      { key: 'name', label: label('columnName'), format: 'text', width: '*' },
      { key: 'category', label: label('columnCategory'), format: 'text', width: 50 },
      { key: 'status', label: label('columnStatus'), format: 'text', width: 42 },
      { key: 'provider', label: label('columnProvider'), format: 'text', width: '*' },
      { key: 'purpose', label: label('columnPurpose'), format: 'text', width: '*' },
      {
        key: 'requiredMinimum',
        label: label('columnRequiredMinimum'),
        format: 'currencyWhole',
        width: 50,
      },
      { key: 'details', label: label('columnDetails'), format: 'text', width: '*' },
    ],
    rows: entries.map((entry) => ({
      cells: {
        name: entry.name,
        category: i18n.translate(`accountCategory.${entry.category}`),
        status: i18n.translate(`accountStatus.${entry.status}`),
        provider: entry.provider,
        purpose: entry.purpose,
        requiredMinimum: entry.requiredMinimum,
        details: details(entry),
      },
    })),
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
    pdfOrientation: 'portrait',
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
    async getPdfSections(): Promise<PdfSection[]> {
      const rows = await firstValueFrom(accountOverviewService.list());
      return rows.length > 0 ? [toPdfSection(rows, i18n)] : [];
    },
    async fetchData(): Promise<ExportRow[]> {
      const rows = await firstValueFrom(accountOverviewService.list());
      return rows.map((entry) => toRow(entry, i18n));
    },
  };
}
