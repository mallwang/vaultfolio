import { exportFeature } from '@vaultfolio/export';
import { RETIREMENT_EXPORT_DEFINITION } from './retirement-export.definition';

describe('RETIREMENT_EXPORT_DEFINITION', () => {
  it('fetchData resolves to an empty array (FR-014)', async () => {
    await expect(RETIREMENT_EXPORT_DEFINITION.fetchData()).resolves.toEqual([]);
  });

  it('produces a valid, empty-but-structured export via exportFeature for every format', async () => {
    for (const format of ['json', 'csv', 'xlsx', 'pdf'] as const) {
      const blob = await exportFeature(
        {
          featureId: RETIREMENT_EXPORT_DEFINITION.featureId,
          title: 'Retirement',
          infobox: 'About retirement',
          columns: [],
          rows: await RETIREMENT_EXPORT_DEFINITION.fetchData(),
        },
        format,
      );
      expect(blob).toBeInstanceOf(Blob);
    }
  });
});
