import type { ExportRow, FeatureExportDefinition } from '@vaultfolio/export';

/**
 * Insurances' `FeatureExportDefinition` (US2, FR-009/FR-014, research.md §5): Insurances has no
 * backend module or data yet — `fetchData` resolves to `[]`, which already satisfies FR-014's
 * "valid but empty" requirement. No `getChartOptions` (no charts). Swapping this for a real data
 * provider later requires no change to the registry, control, or generation code (FR-012).
 */
export const INSURANCES_EXPORT_DEFINITION: FeatureExportDefinition = {
  featureId: 'insurances',
  titleKey: 'insurancesExport.title',
  infoboxKey: 'insurancesExport.infobox',
  columns: [],
  fetchData(): Promise<ExportRow[]> {
    return Promise.resolve([]);
  },
  isEnabled: () => false,
  disabledTooltipKey: 'export.tooltipNotImplemented',
};
