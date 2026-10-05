import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { InsurancesData } from '@vaultfolio/api-contract';
import { I18nService } from '@vaultfolio/frontend-shared-ui';
import { buildInsuranceContract } from '@vaultfolio/insurances/testing';
import { createInsurancesExportDefinition, exportRowsOf } from './insurances-export.definition';

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

  it('exports contracts and linked lines with monthly, yearly and next cancellation', () => {
    const rows = exportRowsOf(data(), t);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      type: 'insurances.types.PRIVATE_LIABILITY',
      premium: '96.00',
      monthly: '8.00',
      yearly: '96.00',
      next: '2026-09-30',
      source: 'insurances.export.source.manual',
    });
    expect(rows[1]).toMatchObject({
      monthly: '400.00',
      yearly: '4800.00',
      next: null,
      source: 'insurances.export.source.earnings',
    });
  });

  it('leaves out linked lines when social insurances are switched off', () => {
    const d = data();
    d.settings.includeSocial = false;
    expect(exportRowsOf(d, t)).toHaveLength(1);
  });

  describe('definition', () => {
    let http: HttpTestingController;

    beforeEach(() => {
      TestBed.configureTestingModule({
        providers: [provideHttpClient(), provideHttpClientTesting(), I18nService],
      });
      http = TestBed.inject(HttpTestingController);
    });

    it('describes the insurances feature and fetches translated rows', async () => {
      const definition = TestBed.runInInjectionContext(createInsurancesExportDefinition);
      expect(definition.featureId).toBe('insurances');
      expect(definition.columns.map((c) => c.key)).toContain('next');
      const pending = definition.fetchData();
      http.expectOne('/api/insurances').flush(data());
      const rows = await pending;
      expect(rows).toHaveLength(2);
      expect(rows[0]['name']).toBe('Privathaftpflicht');
    });

    it('resolves to no rows for 403 and 503', async () => {
      const definition = TestBed.runInInjectionContext(createInsurancesExportDefinition);
      for (const status of [403, 503]) {
        const pending = definition.fetchData();
        http.expectOne('/api/insurances').flush({}, { status, statusText: 'x' });
        await expect(pending).resolves.toEqual([]);
      }
    });
  });
});
