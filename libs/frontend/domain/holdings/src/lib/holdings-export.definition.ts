import { inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { EChartsOption } from 'echarts';
import type { FeatureExportDefinition, ExportRow } from '@vaultfolio/export';
import type { HoldingResponse } from '@vaultfolio/api-contract';
import { I18nService } from '@vaultfolio/frontend-shared-ui';
import { HoldingsService } from './holdings.service';
import { groupHoldingsByKey } from './holdings-valuation';
import { ASSET_TYPE_LABEL_KEYS } from './asset-type-fields';
import {
  buildDistributionChartOption,
  buildTypeBreakdownChartOption,
} from './holdings-distribution/distribution-chart-option';

function toRow(holding: HoldingResponse): ExportRow {
  return {
    assetType: holding.assetType,
    name: holding.name,
    isin: holding.isin,
    management: holding.management,
    quantity: holding.quantity,
    weightGrams: holding.weightGrams,
    purchasePrice: holding.purchasePrice,
    currentValue: holding.currentValue,
    purchaseDate: holding.purchaseDate,
  };
}

/**
 * Holdings' `FeatureExportDefinition` (US1, FR-001–FR-007): registered in
 * `apps/frontend/src/app/export/feature-export.registry.ts`. `columns` covers every field visible
 * in `HoldingsComponent`'s own table (data-model.md, SC-002). `getChartOptions` reproduces the
 * same distribution pie chart shown on the page (FR-004, research.md §3) by re-running the exact
 * same pure grouping/chart-option logic `HoldingsDistributionComponent` uses, against the same
 * holdings list `fetchData` just resolved — `getChartOptions` is synchronous per the
 * `FeatureExportDefinition` contract, so it reads the list `fetchData` cached, not a fresh fetch;
 * `ExportControlComponent`/`exportAll` both always call `fetchData()` before `getChartOptions()`.
 */
export function createHoldingsExportDefinition(): FeatureExportDefinition {
  const holdingsService = inject(HoldingsService);
  const i18n = inject(I18nService);

  let lastFetchedHoldings: HoldingResponse[] = [];

  return {
    featureId: 'holdings',
    titleKey: 'holdingsExport.title',
    infoboxKey: 'holdingsExport.infobox',
    columns: [
      { key: 'assetType', labelKey: 'holdingsExport.columnAssetType', format: 'text' },
      { key: 'name', labelKey: 'holdingsExport.columnName', format: 'text' },
      { key: 'isin', labelKey: 'holdingsExport.columnIsin', format: 'text' },
      { key: 'management', labelKey: 'holdingsExport.columnManagement', format: 'text' },
      { key: 'quantity', labelKey: 'holdingsExport.columnQuantity', format: 'decimal' },
      { key: 'weightGrams', labelKey: 'holdingsExport.columnWeightGrams', format: 'decimal' },
      { key: 'purchasePrice', labelKey: 'holdingsExport.columnPurchasePrice', format: 'currency' },
      { key: 'currentValue', labelKey: 'holdingsExport.columnCurrentValue', format: 'currency' },
      { key: 'purchaseDate', labelKey: 'holdingsExport.columnPurchaseDate', format: 'date' },
    ],
    async fetchData(): Promise<ExportRow[]> {
      const holdings = await firstValueFrom(holdingsService.list());
      lastFetchedHoldings = holdings;
      return holdings.map(toRow);
    },
    getChartOptions(): EChartsOption[] {
      const { entries } = groupHoldingsByKey(lastFetchedHoldings, (holding) => holding.assetType);
      const distributionEntries = entries.map((entry) => ({
        assetType: entry.key,
        value: entry.value.toNumber(),
      }));
      const mainChart = buildDistributionChartOption(
        distributionEntries,
        i18n.language(),
        (entry) => i18n.translate(ASSET_TYPE_LABEL_KEYS[entry.assetType]),
      );
      const typeCharts = entries.map((entry) => {
        const { entries: nameEntries } = groupHoldingsByKey(
          lastFetchedHoldings.filter((h) => h.assetType === entry.key),
          (h) => h.name,
        );
        return buildTypeBreakdownChartOption(
          nameEntries.map((e) => ({ name: e.key, value: e.value.toNumber() })),
          i18n.translate(ASSET_TYPE_LABEL_KEYS[entry.key]),
          i18n.language(),
        );
      });
      return [mainChart, ...typeCharts];
    },
  };
}
