import JSZip from 'jszip';
import { FeatureExportRegistry } from './feature-export-registry.js';
import { exportAll } from './full-export-archive.js';
import type { FeatureExportDefinition } from './feature-export-definition.js';

// Minimal 1×1 transparent PNG — same as in pdf-exporter.spec.ts
const DUMMY_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

function makeDefinition(featureId: string, throwOnFetch = false): FeatureExportDefinition {
  return {
    featureId,
    titleKey: `${featureId}.title`,
    infoboxKey: `${featureId}.infobox`,
    columns: [{ key: 'name', labelKey: 'name', format: 'text' }],
    fetchData: () =>
      throwOnFetch
        ? Promise.reject(new Error('boom'))
        : Promise.resolve([{ name: `${featureId}-row` }]),
  };
}

const resolveLabels = (definition: FeatureExportDefinition) => ({
  title: definition.featureId,
  infobox: `About ${definition.featureId}`,
  columns: definition.columns.map((column) => ({
    key: column.key,
    label: column.key,
    format: column.format,
  })),
});

const resolveChartImages = () => Promise.resolve<string[]>([]);

describe('exportAll', () => {
  it('builds one subdirectory per feature with all 4 formats when everything succeeds', async () => {
    const registry = new FeatureExportRegistry();
    registry.register(makeDefinition('holdings'));
    registry.register(makeDefinition('account-overview'));

    const { archive, failures } = await exportAll(registry, resolveLabels, resolveChartImages);

    expect(failures).toEqual([]);
    const zip = await JSZip.loadAsync(await archive.arrayBuffer());
    for (const featureId of ['holdings', 'account-overview']) {
      for (const ext of ['json', 'csv', 'xlsx', 'pdf']) {
        expect(zip.file(`${featureId}/${featureId}.${ext}`)).not.toBeNull();
      }
    }
  });

  it('calls resolveChartImages when a definition has getChartOptions', async () => {
    const registry = new FeatureExportRegistry();
    registry.register({
      ...makeDefinition('holdings'),
      getChartOptions: () => [],
    });
    const resolveChartImagesSpy = jest.fn().mockResolvedValue([DUMMY_PNG]);

    const { failures } = await exportAll(registry, resolveLabels, resolveChartImagesSpy);

    expect(failures).toEqual([]);
    expect(resolveChartImagesSpy).toHaveBeenCalledTimes(1);
  });

  it('records exactly the one throwing feature/format and still includes every succeeding file', async () => {
    const registry = new FeatureExportRegistry();
    registry.register(makeDefinition('holdings'));
    registry.register(makeDefinition('broken', true));

    const { archive, failures } = await exportAll(registry, resolveLabels, resolveChartImages);

    // 'broken' fails fetchData once per format -> 4 failures, all for 'broken'.
    expect(failures).toHaveLength(4);
    expect(failures.every((f) => f.featureId === 'broken')).toBe(true);
    expect(new Set(failures.map((f) => f.format))).toEqual(new Set(['json', 'csv', 'xlsx', 'pdf']));

    const zip = await JSZip.loadAsync(await archive.arrayBuffer());
    for (const ext of ['json', 'csv', 'xlsx', 'pdf']) {
      expect(zip.file(`holdings/holdings.${ext}`)).not.toBeNull();
      expect(zip.file(`broken/broken.${ext}`)).toBeNull();
    }
  });
});
