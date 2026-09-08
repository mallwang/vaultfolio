import { exportFeature } from '@vaultfolio/export';
import { HAUSHALTSPLANER_EXPORT_DEFINITION } from './haushaltsplaner-export.definition';

describe('HAUSHALTSPLANER_EXPORT_DEFINITION', () => {
  it('fetchData resolves to an empty array (FR-014)', async () => {
    await expect(HAUSHALTSPLANER_EXPORT_DEFINITION.fetchData()).resolves.toEqual([]);
  });

  it('produces a valid, empty-but-structured export via exportFeature for every format', async () => {
    for (const format of ['json', 'csv', 'xlsx', 'pdf'] as const) {
      const blob = await exportFeature(
        {
          featureId: HAUSHALTSPLANER_EXPORT_DEFINITION.featureId,
          title: 'Haushaltsplaner',
          infobox: 'About haushaltsplaner',
          columns: [],
          rows: await HAUSHALTSPLANER_EXPORT_DEFINITION.fetchData(),
        },
        format,
      );
      expect(blob).toBeInstanceOf(Blob);
    }
  });
});
