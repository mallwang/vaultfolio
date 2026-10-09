import { inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import Decimal from 'decimal.js';
import type { EChartsOption } from 'echarts';
import { ASSET_TYPES, findCoin } from '@vaultfolio/domain-holdings';
import type {
  FeatureExportDefinition,
  ExportRow,
  ExportTable,
  ExportTableRow,
  ExportTableColumn,
  PdfCard,
  PdfSection,
  PdfTableColumn,
} from '@vaultfolio/export';
import type { HoldingResponse } from '@vaultfolio/api-contract';
import { I18nService, ASSET_TYPE_COLORS } from '@vaultfolio/frontend-shared-ui';
import { HoldingsService } from './holdings.service';
import { computeHoldingValue, groupHoldingsByKey } from './holdings-valuation';
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
    purchaseSum: computeHoldingValue(holding)?.toString() ?? null,
    management: holding.management,
    note: holding.note,
  };
}

const TOP_N = 5;

/** Same grouping as the on-screen tiles: by name, largest first, top 5, share of `total`. */
function topRows(entries: { key: string; value: number }[], total: number, totalLabel: string) {
  if (!entries.length) return [];
  const sorted = [...entries].sort((a, b) => b.value - a.value);
  return [
    ...sorted.slice(0, TOP_N).map((e) => ({
      cells: { name: e.key, share: total > 0 ? e.value / total : 0, amount: e.value },
    })),
    { cells: { name: totalLabel, share: 1, amount: total }, emphasis: 'total' as const },
  ];
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

  const t = (key: string) => i18n.translate(key);

  async function load(): Promise<HoldingResponse[]> {
    const holdings = await firstValueFrom(holdingsService.list());
    const { entries } = groupHoldingsByKey(holdings, (h) => h.assetType);
    lastDistributionEntries = entries.map((e) => ({ assetType: e.key, value: e.value.toNumber() }));
    return holdings;
  }

  const cardColumns: PdfTableColumn[] = [
    { key: 'name', label: t('holdingsExport.columnName'), format: 'text', width: '*' },
    { key: 'share', label: t('holdingsExport.columnShare'), format: 'percent', width: 'auto' },
    { key: 'amount', label: t('holdingsExport.columnAmount'), format: 'currency', width: 'auto' },
  ];

  function cardsOf(holdings: HoldingResponse[]): PdfCard[] {
    const distTotal = lastDistributionEntries.reduce((sum, e) => sum + e.value, 0);
    const distribution: PdfCard = {
      title: t('holdingsExport.chartDistribution'),
      columns: cardColumns,
      rows: topRows(
        lastDistributionEntries.map((e) => ({
          key: t(ASSET_TYPE_LABEL_KEYS[e.assetType]),
          value: e.value,
        })),
        distTotal,
        t('holdingsExport.total'),
      ),
      emptyText: t('holdingsExport.noPositions'),
    };
    const perType = ASSET_TYPES.map((assetType): PdfCard => {
      const { entries } = groupHoldingsByKey(
        holdings.filter((h) => h.assetType === assetType),
        (h) => holdingAssetName(h, t),
      );
      const values = entries.map((e) => ({ key: e.key, value: e.value.toNumber() }));
      const total = values.reduce((sum, e) => sum + e.value, 0);
      return {
        title: t(ASSET_TYPE_LABEL_KEYS[assetType]),
        color: ASSET_TYPE_COLORS[assetType],
        columns: cardColumns,
        rows: topRows(values, total, t('holdingsExport.total')),
        emptyText: t('holdingsExport.noPositions'),
      };
    });
    return [distribution, ...perType];
  }

  const totalRow = (list: HoldingResponse[]): ExportTableRow => {
    const sum = list.reduce((acc, h) => acc.plus(computeHoldingValue(h) ?? 0), new Decimal(0));
    return {
      cells: { assetType: t('holdingsExport.total'), purchaseSum: sum.toString() },
      emphasis: 'total',
    };
  };

  const tableColumns = (withNote: boolean): ExportTableColumn[] => {
    const text = (key: string, label: string): ExportTableColumn => ({
      key,
      label: t(`holdingsExport.${label}`),
      format: 'text',
    });
    return [
      text('assetType', 'columnAssetType'),
      text('isin', 'columnIsin'),
      text('name', 'columnName'),
      text('metal', 'columnMetal'),
      text('coin', 'columnCoin'),
      { ...text('quantity', 'columnQuantity'), format: 'decimal' },
      text('unit', 'columnUnit'),
      { ...text('purchasePrice', 'columnPurchasePrice'), format: 'money' },
      {
        ...text('purchaseSum', 'columnPurchaseSum'),
        format: 'money',
        formula: '{quantity}*{purchasePrice}',
        formulaNeedsValues: true,
        sumInTotal: true,
      },
      text('management', 'columnManagement'),
      ...(withNote ? [text('note', 'columnNote')] : []),
    ];
  };

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
      {
        key: 'purchaseSum',
        labelKey: 'holdingsExport.columnPurchaseSum',
        format: 'currency',
        summable: true,
      },
      { key: 'management', labelKey: 'holdingsExport.columnManagement', format: 'text' },
      { key: 'note', labelKey: 'holdingsExport.columnNote', format: 'text' },
    ],
    async fetchData(): Promise<ExportRow[]> {
      const holdings = await load();
      return holdings.map((h) => toRow(h, holdingAssetName(h, t)));
    },
    async getPdfSections(): Promise<PdfSection[]> {
      const holdings = await load();
      const text = (key: string, label: string, align?: 'right'): PdfTableColumn => ({
        key,
        label: t(`holdingsExport.${label}`),
        format: 'text',
        ...(align ? { align } : {}),
      });
      return [
        { kind: 'cards', title: t('holdingsExport.cardsTitle'), cards: cardsOf(holdings) },
        {
          kind: 'table',
          title: t('holdingsExport.allPositions'),
          fontSize: 7,
          columns: [
            { ...text('assetType', 'columnAssetType'), width: 'auto' },
            { ...text('isin', 'columnIsin'), width: 'auto' },
            { ...text('name', 'columnName'), width: '*' },
            { ...text('metal', 'columnMetal'), width: 'auto' },
            { ...text('coin', 'columnCoin'), width: 'auto' },
            { ...text('quantity', 'columnQuantity', 'right'), width: 'auto' },
            { ...text('unit', 'columnUnit'), width: 'auto' },
            { ...text('purchasePrice', 'columnPurchasePrice'), format: 'currency', width: 'auto' },
            { ...text('purchaseSum', 'columnPurchaseSum'), format: 'currency', width: 'auto' },
            { ...text('management', 'columnManagement'), width: '*' },
          ],
          rows: [
            ...holdings.map((h) => ({
              cells: {
                ...toRow(h, holdingAssetName(h, t)),
                assetType: t(ASSET_TYPE_LABEL_KEYS[h.assetType]),
              },
            })),
            ...(holdings.length ? [totalRow(holdings)] : []),
          ],
        },
      ];
    },
    async getExportTables(): Promise<ExportTable[]> {
      const holdings = await load();
      const rowsOf = (list: HoldingResponse[]): ExportTableRow[] => {
        const rows: ExportTableRow[] = list.map((h) => ({
          cells: toRow(h, holdingAssetName(h, t)),
        }));
        if (!rows.length) return rows;
        rows.push(totalRow(list));
        return rows;
      };
      return [
        {
          id: 'all',
          title: t('holdingsExport.allPositions'),
          columns: tableColumns(true),
          totalKey: 'allTotal',
          rows: rowsOf(holdings),
          emptyText: t('holdingsExport.noPositions'),
        },
        ...ASSET_TYPES.map((assetType) => ({
          id: assetType,
          title: t(ASSET_TYPE_LABEL_KEYS[assetType]),
          columns: tableColumns(true),
          totalKey: `${assetType}Total`,
          rows: rowsOf(holdings.filter((h) => h.assetType === assetType)),
          emptyText: t('holdingsExport.noPositions'),
        })),
      ];
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
