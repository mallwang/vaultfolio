import { inject, signal } from '@angular/core';

import { firstValueFrom } from 'rxjs';
import { ACCOUNT_CATEGORIES } from '@vaultfolio/account-fields';
import type {
  ExportRow,
  ExportTable,
  FeatureExportDefinition,
  PdfSection,
  PdfTableColumn,
} from '@vaultfolio/export';
import type { AccountOverviewEntry } from '@vaultfolio/api-contract';
import { I18nService } from '@vaultfolio/frontend-shared-ui';
import { AccountOverviewService } from './account-overview.service';

const FIELD_KEYS = [
  'name',
  'category',
  'provider',
  'website',
  'purpose',
  'cardUsage',
  'requiredMinimum',
  'cardNumber',
  'validUntil',
  'notes',
] as const;

/** Entries split by status; within a status they keep the category order of the overview. */
function splitByStatus(entries: AccountOverviewEntry[]) {
  const byCategory = (list: AccountOverviewEntry[]) =>
    ACCOUNT_CATEGORIES.flatMap((category) => list.filter((entry) => entry.category === category));
  return {
    active: byCategory(entries.filter((entry) => entry.status === 'ACTIVE')),
    decommissioned: byCategory(entries.filter((entry) => entry.status === 'DECOMMISSIONED')),
  };
}

function cellsOf(entry: AccountOverviewEntry, i18n: I18nService): Record<string, string | null> {
  return {
    name: entry.name,
    category: i18n.translate(`accountCategory.${entry.category}`),
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

const label = (i18n: I18nService, key: string) => i18n.translate(`accountOverviewExport.${key}`);

const columnKey = (key: (typeof FIELD_KEYS)[number]) =>
  `column${key.charAt(0).toUpperCase()}${key.slice(1)}`;

/** One table per status for JSON, CSV and Excel: the category is a column, not a table of its own. */
function toExportTables(entries: AccountOverviewEntry[], i18n: I18nService): ExportTable[] {
  const { active, decommissioned } = splitByStatus(entries);
  const columns = FIELD_KEYS.map((key) => ({
    key,
    label: label(i18n, columnKey(key)),
    format: 'text' as const,
  }));
  const table = (id: string, titleKey: string, list: AccountOverviewEntry[]): ExportTable => ({
    id,
    title: label(i18n, titleKey),
    columns,
    rows: list.map((entry) => ({ cells: cellsOf(entry, i18n) })),
    emptyText: label(i18n, 'emptyTable'),
  });
  return [
    table('active', 'tableActive', active),
    table('decommissioned', 'tableDecommissioned', decommissioned),
  ];
}

/** PDF: one landscape table per status with a column per field; long text wraps inside its cell. */
function toPdfSections(entries: AccountOverviewEntry[], i18n: I18nService): PdfSection[] {
  const { active, decommissioned } = splitByStatus(entries);
  const columns: PdfTableColumn[] = [
    { key: 'name', label: label(i18n, 'columnName'), format: 'text', width: 70 },
    { key: 'category', label: label(i18n, 'columnCategory'), format: 'text', width: 48 },
    { key: 'provider', label: label(i18n, 'columnProvider'), format: 'text', width: 60 },
    { key: 'purpose', label: label(i18n, 'columnPurpose'), format: 'text', width: '*' },
    {
      key: 'requiredMinimum',
      label: label(i18n, 'columnRequiredMinimum'),
      format: 'text',
      width: 62,
    },
    { key: 'website', label: label(i18n, 'columnWebsite'), format: 'text', width: 70 },
    { key: 'cardUsage', label: label(i18n, 'columnCardUsage'), format: 'text', width: '*' },
    { key: 'cardNumber', label: label(i18n, 'columnCardNumber'), format: 'text', width: 62 },
    { key: 'validUntil', label: label(i18n, 'columnValidUntil'), format: 'text', width: 34 },
    { key: 'notes', label: label(i18n, 'columnNotes'), format: 'text', width: '*' },
  ];
  const section = (titleKey: string, list: AccountOverviewEntry[]): PdfSection => ({
    kind: 'table',
    title: label(i18n, titleKey),
    startOnNewPage: false,
    fontSize: 7,
    columns,
    rows: list.map((entry) => ({ cells: cellsOf(entry, i18n) })),
  });
  return [
    ...(active.length > 0 ? [section('tableActive', active)] : []),
    ...(decommissioned.length > 0 ? [section('tableDecommissioned', decommissioned)] : []),
  ];
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
  const accounts = signal<AccountOverviewEntry[]>([]);
  let requested = false;
  // Registered at app bootstrap, i.e. before sign-in: fetch only once the export control asks.
  const ensureLoaded = () => {
    if (requested) return;
    requested = true;
    accountOverviewService.list().subscribe({
      next: (rows) => accounts.set(rows),
      error: () => undefined,
    });
  };

  return {
    featureId: 'account-overview',
    titleKey: 'accountOverviewExport.title',
    infoboxKey: 'accountOverviewExport.infobox',
    formatDataKeys: {
      pdf: 'accountOverviewExport.data.pdf',
      xlsx: 'accountOverviewExport.data.xlsx',
      csv: 'accountOverviewExport.data.csv',
      json: 'accountOverviewExport.data.json',
    },
    // The data formats are served by `getExportTables`; there is no generic row table.
    columns: [],
    isEnabled: () => {
      ensureLoaded();
      return accounts().length > 0;
    },
    disabledTooltipKey: 'export.tooltipNoData',
    async getPdfSections(): Promise<PdfSection[]> {
      return toPdfSections(await firstValueFrom(accountOverviewService.list()), i18n);
    },
    fetchData: (): Promise<ExportRow[]> => Promise.resolve([]),
    async getExportTables(): Promise<ExportTable[]> {
      return toExportTables(await firstValueFrom(accountOverviewService.list()), i18n);
    },
  };
}
