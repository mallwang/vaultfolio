import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import type { EarningsOverview, EarningsTables } from '@vaultfolio/api-contract';
import { en } from '@vaultfolio/frontend-shared-ui';
import { createEarningsExportDefinition } from './earnings-export.definition';

function lookup(key: string): unknown {
  return key
    .split('.')
    .reduce<unknown>((node, part) => (node as Record<string, unknown>)?.[part], en);
}

describe('createEarningsExportDefinition', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  it('has no per-payslip data any more: no columns and an empty generic fetch', async () => {
    const definition = TestBed.runInInjectionContext(createEarningsExportDefinition);
    expect(definition.columns).toEqual([]);
    expect(await definition.fetchData()).toEqual([]);
    http.expectNone('/api/earnings/records');
  });

  it('has translated title and infoboxes', () => {
    const definition = TestBed.runInInjectionContext(createEarningsExportDefinition);
    expect(typeof lookup(definition.titleKey)).toBe('string');
    expect(typeof lookup(definition.infoboxKey)).toBe('string');
    expect(lookup(definition.infoboxKey)).not.toMatch(/payslip section/i);
  });

  describe('PDF sections (035)', () => {
    const overview: EarningsOverview = {
      hasData: true,
      career: [
        {
          key: 'e1',
          label: 'Brightline Software GmbH',
          firstPeriod: '2025-01',
          lastPeriod: '2026-09',
          monthsEmployed: 21,
          employerCount: 1,
          totals: {
            gross: '105000.00',
            net: '65000.00',
            taxes: '24000.00',
            social: '16000.00',
            bonus: '5000.00',
          },
          perMonth: { gross: '0.00', net: '0.00', taxes: '0.00', social: '0.00', bonus: '0.00' },
          netRatio: '0.6190',
        },
      ],
      latestYear: null,
      yearly: [
        {
          year: 2025,
          monthsEmployed: 12,
          gross: '60000.00',
          regular: '55000.00',
          bonus: '5000.00',
          net: '37000.00',
          taxes: '14000.00',
          social: '9000.00',
          taxRatio: '0.2333',
          socialRatio: '0.1500',
        },
      ],
      monthly: [],
      employerChanges: [],
      dataCheckIssues: 0,
    };
    const tables: EarningsTables = {
      monthGrid: {
        years: [2025],
        metrics: {
          gross: { '2025-01': '5000.00' },
          regular: {},
          bonus: {},
          net: {},
          taxes: {},
          social: {},
          payout: {},
        },
        bonusPeriods: [],
        missingPeriods: [],
      },
      taxesPerYear: [],
      certificates: [],
    };

    function flush(o: EarningsOverview = overview) {
      http.expectOne('/api/earnings/overview').flush(o);
      http.expectOne('/api/earnings/tables').flush(tables);
    }

    it('has its own infobox that does not describe payslip-part rows', () => {
      const definition = TestBed.runInInjectionContext(createEarningsExportDefinition);
      expect(definition.pdfInfoboxKey).toBe('earnings.export.pdfInfobox');
      expect(lookup(definition.pdfInfoboxKey as string)).not.toMatch(/payslip section/i);
    });

    it('captures the chart in a wide format for the full-width PDF chart', () => {
      const definition = TestBed.runInInjectionContext(createEarningsExportDefinition);
      expect(definition.pdfChartSize).toEqual({ width: 1000, height: 330 });
    });

    it('requests overview and tables without an employer filter and builds the sections', async () => {
      const definition = TestBed.runInInjectionContext(createEarningsExportDefinition);
      const sections = definition.getPdfSections?.();
      flush();

      const result = await sections;
      expect(result?.map((x) => (x.kind === 'table' ? x.title : x.text))).toEqual([
        'Totals per employer',
        'Monthly overview gross / net',
        'All taxes and contributions per year',
      ]);
    });

    it('offers the gross-per-year chart in the light palette after the sections were built', async () => {
      const definition = TestBed.runInInjectionContext(createEarningsExportDefinition);
      expect(definition.getChartOptions?.()).toEqual([]);

      const sections = definition.getPdfSections?.();
      flush();
      await sections;

      const [option] = definition.getChartOptions?.() ?? [];
      expect(option['xAxis'].data).toEqual(['2025']);
      expect(option['title'].text).toBe('Gross per year');
      expect(option['series'].map((x: { name: string }) => x.name)).toEqual([
        'Regular pay',
        'Bonus & one-off payments',
      ]);
    });

    it('returns only the empty state and no chart without data', async () => {
      const definition = TestBed.runInInjectionContext(createEarningsExportDefinition);
      const sections = definition.getPdfSections?.();
      flush({ ...overview, hasData: false, career: [], yearly: [] });

      expect(await sections).toEqual([{ kind: 'text', text: 'There is no earnings data yet.' }]);
      expect(definition.getChartOptions?.()).toEqual([]);
    });

    it('returns the empty state for a member without the Earnings domain', async () => {
      const definition = TestBed.runInInjectionContext(createEarningsExportDefinition);
      const sections = definition.getPdfSections?.();
      const forbidden = { status: 403, statusText: 'Forbidden' };
      http.expectOne('/api/earnings/overview').flush({ error: 'DOMAIN_NOT_ENTITLED' }, forbidden);
      http.match('/api/earnings/tables').forEach((r) => r.flush({}, forbidden));

      expect(await sections).toEqual([{ kind: 'text', text: 'There is no earnings data yet.' }]);
    });

    it('lets an unavailable-key response (503) fail the export instead of exporting wrong figures', async () => {
      const definition = TestBed.runInInjectionContext(createEarningsExportDefinition);
      const sections = definition.getPdfSections?.();
      const unavailable = { status: 503, statusText: 'Service Unavailable' };
      http
        .expectOne('/api/earnings/overview')
        .flush({ error: 'EARNINGS_UNAVAILABLE' }, unavailable);
      http.match('/api/earnings/tables').forEach((r) => r.flush({}, unavailable));

      await expect(sections).rejects.toMatchObject({ status: 503 });
    });

    describe('export tables (035 phase 2)', () => {
      it('builds the four tables from overview and tables without an employer filter', async () => {
        const definition = TestBed.runInInjectionContext(createEarningsExportDefinition);
        const result = definition.getExportTables?.();
        flush();

        const tablesResult = await result;
        expect(tablesResult?.map((x) => x.id)).toEqual([
          'grossPerYear',
          'employers',
          'monthlyOverview',
          'taxesPerYear',
        ]);
        expect(tablesResult?.[1].rows.at(-1)).toMatchObject({
          emphasis: 'total',
          cells: { employer: 'Career total', gross: '105000.00' },
        });
        expect(tablesResult?.[0].rows[0].cells).toMatchObject({ year: 2025, gross: '60000.00' });
      });

      it('returns the four tables without rows for a member without the Earnings domain', async () => {
        const definition = TestBed.runInInjectionContext(createEarningsExportDefinition);
        const result = definition.getExportTables?.();
        const forbidden = { status: 403, statusText: 'Forbidden' };
        http.expectOne('/api/earnings/overview').flush({ error: 'DOMAIN_NOT_ENTITLED' }, forbidden);
        http.match('/api/earnings/tables').forEach((r) => r.flush({}, forbidden));

        const tablesResult = await result;
        expect(tablesResult).toHaveLength(4);
        expect(tablesResult?.every((x) => x.rows.length === 0 && x.columns.length > 0)).toBe(true);
      });

      it('lets a 503 fail the export instead of exporting wrong figures', async () => {
        const definition = TestBed.runInInjectionContext(createEarningsExportDefinition);
        const result = definition.getExportTables?.();
        const unavailable = { status: 503, statusText: 'Service Unavailable' };
        http
          .expectOne('/api/earnings/overview')
          .flush({ error: 'EARNINGS_UNAVAILABLE' }, unavailable);
        http.match('/api/earnings/tables').forEach((r) => r.flush({}, unavailable));

        await expect(result).rejects.toMatchObject({ status: 503 });
      });
    });
  });
});
