import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { InsurancesData } from '@vaultfolio/api-contract';
import { I18nService } from '@vaultfolio/frontend-shared-ui';
import { buildInsuranceContract } from '@vaultfolio/insurances/testing';
import { createInsurancesExportDefinition } from './insurances-export.definition';
import { buildInsurancesExportTables } from './insurances-export-tables';
import { buildInsurancesReport } from './insurances-pdf-sections';

const data = (): InsurancesData => ({
  contracts: [
    buildInsuranceContract({
      id: 'c1',
      endDate: '2026-12-31',
      cancellation: { autoRenew: true, period: { value: 3, unit: 'MONTHS' } },
    }),
  ] as InsurancesData['contracts'],
  linkedSocial: [{ kind: 'HEALTH', monthly: '400.00', period: '2026-09' }],
  settings: {
    profile: {
      ownsProperty: false,
      ownsCar: false,
      hasChildren: false,
      hasPets: false,
      travelsAbroad: false,
      employment: 'EMPLOYED',
    },
    reminders: { enabled: false, leadDays: 30 },
    dismissedRequirements: [],
    includeSocial: true,
  },
  today: '2026-09-10',
});

describe('insurances export', () => {
  const t = (key: string) => key;

  const tables = (d = data()) => buildInsurancesExportTables(buildInsurancesReport(d, t), t);
  const table = (id: string, d = data()) => {
    const found = tables(d).find((x) => x.id === id);
    if (!found) throw new Error(`table ${id} missing`);
    return found;
  };

  it('exports the same sections as the PDF as tables', () => {
    expect(tables().map((x) => x.id)).toEqual([
      'figures',
      'groups',
      'contracts',
      'recommendations',
      'covered',
      'overlaps',
      'other',
    ]);
    expect(table('figures').rows[0].cells).toMatchObject({ active: 1, monthly: '408.00' });
  });

  it('lists contracts and linked lines with cost, next cancellation and a total', () => {
    const { rows, columns } = table('contracts');
    expect(rows).toHaveLength(3);
    // Largest yearly cost first, as in the PDF.
    expect(rows[1].cells).toMatchObject({
      premium: '96.00',
      paymentsPerYear: 1,
      monthly: '8.00',
      yearly: '96.00',
      next: '2026-09-30',
      source: 'insurances.export.source.manual',
    });
    expect(rows[0].cells).toMatchObject({
      monthly: '400.00',
      yearly: '4800.00',
      next: null,
      source: 'insurances.export.source.earnings',
    });
    expect(rows[2]).toMatchObject({ emphasis: 'total', cells: { yearly: '4896.00' } });
    expect(columns.find((c) => c.key === 'yearly')?.formula).toContain('{premium}');
  });

  it('leaves out linked lines when social insurances are switched off', () => {
    const d = data();
    d.settings.includeSocial = false;
    expect(table('contracts', d).rows).toHaveLength(2);
  });

  describe('definition', () => {
    let http: HttpTestingController;

    beforeEach(() => {
      TestBed.configureTestingModule({
        providers: [provideHttpClient(), provideHttpClientTesting(), I18nService],
      });
      http = TestBed.inject(HttpTestingController);
    });

    it('describes the insurances feature and fetches the export tables', async () => {
      const definition = TestBed.runInInjectionContext(createInsurancesExportDefinition);
      expect(definition.featureId).toBe('insurances');
      const pending = definition.getExportTables?.();
      http.expectOne('/api/insurances').flush(data());
      const result = await pending;
      expect(result).toHaveLength(7);
      expect(result?.[2].rows[1].cells['name']).toBe('Privathaftpflicht');
    });

    it('builds PDF sections and a chart from the same data', async () => {
      const definition = TestBed.runInInjectionContext(createInsurancesExportDefinition);
      expect(definition.getChartOptions?.()).toEqual([]);
      const pending = definition.getPdfSections?.();
      http.expectOne('/api/insurances').flush(data());
      const sections = await pending;
      expect(sections?.map((s) => s.kind)).toContain('kpis');
      expect(sections?.filter((s) => s.kind === 'table').length).toBeGreaterThanOrEqual(5);
      expect(definition.getChartOptions?.()).toHaveLength(1);
    });

    it('resolves to no tables for 403 and 503', async () => {
      const definition = TestBed.runInInjectionContext(createInsurancesExportDefinition);
      for (const status of [403, 503]) {
        const pending = definition.getExportTables?.();
        http.expectOne('/api/insurances').flush({}, { status, statusText: 'x' });
        await expect(pending).resolves.toEqual([]);
      }
    });
  });
});
