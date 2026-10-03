import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { exportFeature } from '@vaultfolio/export';
import { buildRecord } from '@vaultfolio/retirement/testing';
import { createRetirementExportDefinition } from './retirement-export.definition';

describe('createRetirementExportDefinition', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  const definition = () => TestBed.runInInjectionContext(createRetirementExportDefinition);

  it('maps one row per record with guaranteed, expected and contributions', async () => {
    const pending = definition().fetchData();
    http.expectOne('/api/retirement/records').flush([
      buildRecord({
        id: 'a',
        identifier: 'R-1',
        figures: {
          guaranteedMonthly: '100.00',
          expectedMonthly: '150.00',
          contributionMonthly: '60.00',
          employerContributionMonthly: '10.50',
        },
      }),
      buildRecord({
        id: 's',
        contractType: 'STATUTORY_PENSION',
        figures: { projectedMonthly: '2000.00' },
      }),
    ]);
    const rows = await pending;
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      number: 'R-1',
      guaranteed: '100.00',
      expected: '150.00',
      contribution: '70.50',
      origin: 'Manual',
    });
    expect(rows[1]).toMatchObject({ guaranteed: null, expected: '2000.00', contribution: null });
  });

  it.each([403, 503])('resolves to no rows on a %s', async (status) => {
    const pending = definition().fetchData();
    http.expectOne('/api/retirement/records').flush({}, { status, statusText: 'x' });
    await expect(pending).resolves.toEqual([]);
  });

  it('rethrows other failures', async () => {
    const pending = definition().fetchData();
    http.expectOne('/api/retirement/records').flush({}, { status: 500, statusText: 'x' });
    await expect(pending).rejects.toBeDefined();
  });

  it('produces a structured export for every format', async () => {
    const def = definition();
    const pending = def.fetchData();
    http.expectOne('/api/retirement/records').flush([buildRecord()]);
    const rows = await pending;
    for (const format of ['json', 'csv', 'xlsx', 'pdf'] as const) {
      const blob = await exportFeature(
        {
          featureId: def.featureId,
          title: 'Retirement',
          infobox: 'About',
          columns: def.columns.map((c) => ({ key: c.key, label: c.key, format: c.format })),
          rows,
        },
        format,
      );
      expect(blob).toBeInstanceOf(Blob);
    }
  });
});
