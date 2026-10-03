import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import type {
  EarningsOverview,
  EarningsRecordDetail,
  EarningsTables,
} from '@vaultfolio/api-contract';
import { en } from '@vaultfolio/frontend-shared-ui';
import { createEarningsExportDefinition } from './earnings-export.definition';

function record(
  period: string,
  issued: string,
  kind: EarningsRecordDetail['kind'],
  seq: number,
): EarningsRecordDetail {
  return {
    id: `${period}-${seq}`,
    employerId: 'e1',
    employerLabel: 'Brightline Software GmbH',
    period,
    issued,
    kind,
    seq,
    import: { id: 'i1', fileName: `${issued}.pdf` },
    amounts: {
      gross: '5000.00',
      taxGross: '5000.00',
      svGrossKv: '5000.00',
      svGrossRv: '5000.00',
      wageTax: '800.00',
      soli: '0.00',
      churchTax: '64.00',
      health: '400.00',
      care: '90.00',
      pension: '465.00',
      unemployment: '65.00',
      net: '3116.00',
      other: '-40.00',
      payout: kind === 'CORRECTION' ? null : '3076.00',
      oneOff: {},
      employerSubsidy: null,
      ytd: null,
      checks: [],
    },
  };
}

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

  it('exports every record oldest first with employer, period, issued, kind and exact amounts', async () => {
    const definition = TestBed.runInInjectionContext(createEarningsExportDefinition);
    const rows = definition.fetchData();
    http
      .expectOne('/api/earnings/records')
      .flush([
        record('2026-09', '2026-09', 'REGULAR', 1),
        record('2026-07', '2026-09', 'CORRECTION', 3),
      ]);

    const result = await rows;
    expect(result.map((r) => [r['period'], r['kind']])).toEqual([
      ['2026-07', 'Correction'],
      ['2026-09', 'Payslip'],
    ]);
    expect(result[1]).toMatchObject({
      employer: 'Brightline Software GmbH',
      issued: '2026-09',
      net: '3116.00',
      payout: '3076.00',
      bonus: '0.00',
    });
    expect(result[0]['payout']).toBeNull();
  });

  it('exports the names of corrected figures, never values', async () => {
    const definition = TestBed.runInInjectionContext(createEarningsExportDefinition);
    const rows = definition.fetchData();
    const corrected = record('2026-09', '2026-09', 'REGULAR', 1);
    corrected.amounts.corrected = ['wageTax', 'net'];
    http
      .expectOne('/api/earnings/records')
      .flush([corrected, record('2026-08', '2026-08', 'REGULAR', 1)]);
    const result = await rows;
    expect(result.map((r) => r['corrected'])).toEqual(['', 'wageTax, net']);
    expect(definition.columns.map((c) => c.key)).toContain('corrected');
  });

  it('returns no rows for a member without the Earnings domain', async () => {
    const definition = TestBed.runInInjectionContext(createEarningsExportDefinition);
    const rows = definition.fetchData();
    http
      .expectOne('/api/earnings/records')
      .flush({ error: 'DOMAIN_NOT_ENTITLED' }, { status: 403, statusText: 'Forbidden' });
    expect(await rows).toEqual([]);
  });

  it('has a translated label for every column', () => {
    const definition = TestBed.runInInjectionContext(createEarningsExportDefinition);
    expect(definition.columns.filter((c) => typeof lookup(c.labelKey) !== 'string')).toEqual([]);
    expect(typeof lookup(definition.titleKey)).toBe('string');
    expect(typeof lookup(definition.infoboxKey)).toBe('string');
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
      expect(lookup(definition.infoboxKey)).toMatch(/payslip section/i);
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

    it('leaves the CSV/XLSX/JSON data path unchanged', () => {
      const definition = TestBed.runInInjectionContext(createEarningsExportDefinition);
      expect(definition.columns.map((c) => c.key)).toEqual([
        'employer',
        'period',
        'issued',
        'kind',
        'gross',
        'bonus',
        'taxGross',
        'svGrossKv',
        'svGrossRv',
        'wageTax',
        'soli',
        'churchTax',
        'health',
        'care',
        'pension',
        'unemployment',
        'net',
        'other',
        'payout',
        'source',
        'corrected',
      ]);
    });
  });
});
