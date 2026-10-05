import { HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import type { InsurancesData } from '@vaultfolio/api-contract';
import type { ExportRow, FeatureExportDefinition } from '@vaultfolio/export';
import { I18nService } from '@vaultfolio/frontend-shared-ui';
import { firstValueFrom } from 'rxjs';
import { buildRows } from './insurances-view';
import { InsurancesService } from './insurances.service';

/** One row per contract and linked statutory line; the same derivations as the screen. */
export function exportRowsOf(data: InsurancesData, t: (key: string) => string): ExportRow[] {
  return buildRows({
    contracts: data.contracts,
    linked: data.linkedSocial.filter(() => data.settings.includeSocial),
    gaps: { missing: [], covered: [], dismissed: [], redundant: [] },
    today: data.today,
    warnDays: 0,
    t: (key) => t(key),
  }).map((row) => ({
    type: t(`insurances.types.${row.typeId}`),
    name: row.name,
    insurer: row.insurer ?? '',
    status: t(row.active ? 'insurances.status.ACTIVE' : 'insurances.status.inactive'),
    premium: row.premium,
    interval: t(`insurances.intervals.${row.interval}`),
    monthly: row.monthly,
    yearly: row.yearly,
    next: row.info.kind === 'DEADLINE' || row.info.kind === 'ENDS' ? row.info.date : null,
    source: t(
      row.kind === 'LINKED'
        ? 'insurances.export.source.earnings'
        : 'insurances.export.source.manual',
    ),
  }));
}

/**
 * Insurances' `FeatureExportDefinition` (029 capability, FR-017): the generic table of every
 * contract plus the linked statutory lines, with the monthly and yearly cost and the next
 * cancellation date. "Export my data" iterates every registered feature regardless of entitlement,
 * so a member without the domain (403) or an unavailable domain (503) gets an empty table.
 */
export function createInsurancesExportDefinition(): FeatureExportDefinition {
  const api = inject(InsurancesService);
  const i18n = inject(I18nService);

  return {
    featureId: 'insurances',
    titleKey: 'insurances.export.title',
    infoboxKey: 'insurances.export.infobox',
    columns: [
      { key: 'type', labelKey: 'insurances.export.columns.type', format: 'text' },
      { key: 'name', labelKey: 'insurances.export.columns.name', format: 'text' },
      { key: 'insurer', labelKey: 'insurances.export.columns.insurer', format: 'text' },
      { key: 'status', labelKey: 'insurances.export.columns.status', format: 'text' },
      { key: 'premium', labelKey: 'insurances.export.columns.premium', format: 'decimal' },
      { key: 'interval', labelKey: 'insurances.export.columns.interval', format: 'text' },
      { key: 'monthly', labelKey: 'insurances.export.columns.monthly', format: 'decimal' },
      { key: 'yearly', labelKey: 'insurances.export.columns.yearly', format: 'decimal' },
      { key: 'next', labelKey: 'insurances.export.columns.next', format: 'date' },
      { key: 'source', labelKey: 'insurances.export.columns.source', format: 'text' },
    ],
    async fetchData(): Promise<ExportRow[]> {
      try {
        const data = await firstValueFrom(api.data());
        return exportRowsOf(data, (key) => i18n.translate(key));
      } catch (error) {
        if (error instanceof HttpErrorResponse && (error.status === 403 || error.status === 503)) {
          return [];
        }
        throw error;
      }
    },
  };
}
