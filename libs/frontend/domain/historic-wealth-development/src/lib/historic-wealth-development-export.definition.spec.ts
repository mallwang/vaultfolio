import { exportFeature } from '@vaultfolio/export';
import { HISTORIC_WEALTH_DEVELOPMENT_EXPORT_DEFINITION } from './historic-wealth-development-export.definition';

describe('HISTORIC_WEALTH_DEVELOPMENT_EXPORT_DEFINITION', () => {
  it('fetchData resolves to an empty array (FR-014)', async () => {
    await expect(HISTORIC_WEALTH_DEVELOPMENT_EXPORT_DEFINITION.fetchData()).resolves.toEqual([]);
  });

  it('produces a valid, empty-but-structured export via exportFeature for every format', async () => {
    for (const format of ['json', 'csv', 'xlsx', 'pdf'] as const) {
      const blob = await exportFeature(
        {
          featureId: HISTORIC_WEALTH_DEVELOPMENT_EXPORT_DEFINITION.featureId,
          title: 'Wealth Development',
          infobox: 'About wealth development',
          columns: [],
          rows: await HISTORIC_WEALTH_DEVELOPMENT_EXPORT_DEFINITION.fetchData(),
        },
        format,
      );
      expect(blob).toBeInstanceOf(Blob);
    }
  });
});
