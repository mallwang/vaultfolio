import { exportFeature } from '@vaultfolio/export';
import { INSURANCES_EXPORT_DEFINITION } from './insurances-export.definition';

describe('INSURANCES_EXPORT_DEFINITION', () => {
  it('fetchData resolves to an empty array (FR-014)', async () => {
    await expect(INSURANCES_EXPORT_DEFINITION.fetchData()).resolves.toEqual([]);
  });

  it('produces a valid, empty-but-structured export via exportFeature for every format', async () => {
    for (const format of ['json', 'csv', 'xlsx', 'pdf'] as const) {
      const blob = await exportFeature(
        {
          featureId: INSURANCES_EXPORT_DEFINITION.featureId,
          title: 'Insurances',
          infobox: 'About insurances',
          columns: [],
          rows: await INSURANCES_EXPORT_DEFINITION.fetchData(),
        },
        format,
      );
      expect(blob).toBeInstanceOf(Blob);
    }
  });
});
