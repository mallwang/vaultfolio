import { inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { EChartsOption } from 'echarts';
import { findCoin } from '@vaultfolio/domain-holdings';
import type { FeatureExportDefinition, ExportRow } from '@vaultfolio/export';
import type { HoldingResponse } from '@vaultfolio/api-contract';
import { I18nService, ASSET_TYPE_COLORS } from '@vaultfolio/frontend-shared-ui';
import { HoldingsService } from './holdings.service';
import { groupHoldingsByKey } from './holdings-valuation';
import { ASSET_TYPE_LABEL_KEYS, holdingAssetName } from './holding-display';
import { buildDistributionChartOption } from './holdings-distribution/distribution-chart-option';

function toRow(holding: HoldingResponse, assetName: string): ExportRow {
  return {
    assetType: holding.assetType,
    isin: holding.isin,
    name: assetName,
    metal: holding.metal,
    coin: holding.coinId ? (findCoin(holding.coinId)?.symbol ?? holding.coinId) : null,
    quantity: holding.quantity,
    unit: holding.unit,
    purchasePrice: holding.purchasePrice,
    purchaseDate: holding.purchaseDate,
    currentValue: holding.currentValue,
    management: holding.management,
    note: holding.note,
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

  let lastDistributionEntries: { assetType: HoldingResponse['assetType']; value: number }[] = [];

  return {
    featureId: 'holdings',
    titleKey: 'holdingsExport.title',
    infoboxKey: 'holdingsExport.infobox',
    columns: [
      { key: 'assetType', labelKey: 'holdingsExport.columnAssetType', format: 'text' },
      { key: 'isin', labelKey: 'holdingsExport.columnIsin', format: 'text' },
      { key: 'name', labelKey: 'holdingsExport.columnName', format: 'text' },
      { key: 'metal', labelKey: 'holdingsExport.columnMetal', format: 'text' },
      { key: 'coin', labelKey: 'holdingsExport.columnCoin', format: 'text' },
      { key: 'quantity', labelKey: 'holdingsExport.columnQuantity', format: 'decimal' },
      { key: 'unit', labelKey: 'holdingsExport.columnUnit', format: 'text' },
      { key: 'purchasePrice', labelKey: 'holdingsExport.columnPurchasePrice', format: 'currency' },
      { key: 'purchaseDate', labelKey: 'holdingsExport.columnPurchaseDate', format: 'date' },
      {
        key: 'currentValue',
        labelKey: 'holdingsExport.columnCurrentValue',
        format: 'currency',
        summable: true,
      },
      { key: 'management', labelKey: 'holdingsExport.columnManagement', format: 'text' },
      { key: 'note', labelKey: 'holdingsExport.columnNote', format: 'text' },
    ],
    async fetchData(): Promise<ExportRow[]> {
      const holdings = await firstValueFrom(holdingsService.list());
      const { entries } = groupHoldingsByKey(holdings, (h) => h.assetType);
      lastDistributionEntries = entries.map((e) => ({
        assetType: e.key,
        value: e.value.toNumber(),
      }));
      return holdings.map((h) =>
        toRow(
          h,
          holdingAssetName(h, (k) => i18n.translate(k)),
        ),
      );
    },
    getChartOptions(): EChartsOption[] {
      // No title — section heading is rendered above the chart section in the PDF layout.
      return [
        buildDistributionChartOption(lastDistributionEntries, i18n.language(), (entry) =>
          i18n.translate(ASSET_TYPE_LABEL_KEYS[entry.assetType]),
        ),
      ];
    },
    getChartSideTable() {
      const total = lastDistributionEntries.reduce((sum, e) => sum + e.value, 0);
      return {
        sectionTitle: i18n.translate('holdingsExport.chartDistribution'),
        rows: lastDistributionEntries.map((entry) => ({
          label: i18n.translate(ASSET_TYPE_LABEL_KEYS[entry.assetType]),
          value: entry.value,
          percentage: total > 0 ? (entry.value / total) * 100 : 0,
          color: ASSET_TYPE_COLORS[entry.assetType],
        })),
      };
    },
  };
}
