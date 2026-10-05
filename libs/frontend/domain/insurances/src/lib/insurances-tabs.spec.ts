import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CURRENT_USER_SOURCE } from '@vaultfolio/frontend-domain-access';
import type { InsurancesData } from '@vaultfolio/api-contract';
import { DEFAULT_SETTINGS } from '@vaultfolio/insurances';
import { buildInsuranceContract } from '@vaultfolio/insurances/testing';
import { InsurancesStore } from './insurances-store';
import { InsurancesContractsComponent } from './contracts/contracts.component';
import { InsurancesGapCheckComponent } from './gap-check/gap-check.component';
import { InsurancesOverviewComponent } from './overview/overview.component';

vi.mock('echarts', () => ({
  init: () => ({
    on: vi.fn(),
    setOption: vi.fn(),
    resize: vi.fn(),
    dispose: vi.fn(),
    showLoading: vi.fn(),
    hideLoading: vi.fn(),
  }),
}));

const base = (over: Partial<InsurancesData> = {}): InsurancesData => ({
  contracts: [],
  linkedSocial: [],
  settings: structuredClone(DEFAULT_SETTINGS),
  today: '2026-09-10',
  ...over,
});

const deadlineContract = {
  ...buildInsuranceContract({
    id: 'c1',
    name: 'Haftpflicht',
    endDate: '2026-12-31',
    cancellation: { autoRenew: true, period: { value: 3, unit: 'MONTHS' as const } },
  }),
};

describe('insurances tabs', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe = vi.fn();
        disconnect = vi.fn();
        unobserve = vi.fn();
      },
    );
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: CURRENT_USER_SOURCE, useValue: { current: () => ({ id: 'user-1' }) } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  async function render<T>(component: new () => T, body: InsurancesData) {
    const fixture = TestBed.createComponent(component);
    TestBed.inject(InsurancesStore).ensureLoaded();
    fixture.detectChanges();
    http.expectOne('/api/insurances').flush(body);
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  const q = (fixture: { nativeElement: HTMLElement }, id: string) =>
    fixture.nativeElement.querySelector(`[data-testid="${id}"]`);
  const txt = (fixture: { nativeElement: HTMLElement }, id: string) =>
    q(fixture, id)?.textContent?.replace(/\s+/g, ' ').trim();

  describe('overview', () => {
    it('shows the empty state without contracts', async () => {
      const f = await render(InsurancesOverviewComponent, base());
      expect(q(f, 'insurances-empty')).not.toBeNull();
      expect(q(f, 'insurances-kpi-monthly')).toBeNull();
    });

    it('shows KPIs, deadline highlight, upcoming list and gap summary', async () => {
      const f = await render(
        InsurancesOverviewComponent,
        base({ contracts: [deadlineContract] as InsurancesData['contracts'] }),
      );
      expect(txt(f, 'insurances-kpi-monthly')).toContain('8.00');
      expect(txt(f, 'insurances-kpi-yearly')).toContain('96.00');
      expect(txt(f, 'insurances-kpi-active')).toContain('1');
      expect(q(f, 'insurances-kpi-next')?.classList).toContain('kpi--warn');
      expect(q(f, 'insurances-upcoming-c1')).not.toBeNull();
      expect(q(f, 'insurances-gap-summary-count')).not.toBeNull();
    });

    it('counts linked statutory lines and shows them as secondary figure', async () => {
      const f = await render(
        InsurancesOverviewComponent,
        base({ linkedSocial: [{ kind: 'HEALTH', monthly: '400.00', period: '2026-09' }] }),
      );
      expect(txt(f, 'insurances-kpi-monthly')).toContain('400.00');
      expect(q(f, 'insurances-kpi-monthly-statutory')).not.toBeNull();
    });
  });

  describe('contracts', () => {
    it('lists contracts with the monthly equivalent and the next cancellation', async () => {
      const f = await render(
        InsurancesContractsComponent,
        base({ contracts: [deadlineContract] as InsurancesData['contracts'] }),
      );
      expect(q(f, 'insurances-row-c1')).not.toBeNull();
      expect(txt(f, 'insurances-monthly-c1')).toContain('8.00');
      expect(q(f, 'insurances-next-c1')?.classList).toContain('warn');
      expect(q(f, 'insurances-edit-c1')).not.toBeNull();
    });

    it('shows linked rows read-only with source and manual action', async () => {
      const f = await render(
        InsurancesContractsComponent,
        base({ linkedSocial: [{ kind: 'HEALTH', monthly: '400.00', period: '2026-09' }] }),
      );
      expect(q(f, 'insurances-row-linked-HEALTH')).not.toBeNull();
      expect(txt(f, 'insurances-source-linked-HEALTH')).toContain('09/2026');
      expect(q(f, 'insurances-edit-linked-HEALTH')).toBeNull();
      expect(q(f, 'insurances-make-manual-linked-HEALTH')).not.toBeNull();
    });

    it('deletes a contract after confirmation', async () => {
      const f = await render(
        InsurancesContractsComponent,
        base({ contracts: [deadlineContract] as InsurancesData['contracts'] }),
      );
      (q(f, 'insurances-delete-c1') as HTMLButtonElement).click();
      f.detectChanges();
      expect(document.body.textContent).toContain('Haftpflicht');
      (
        document.querySelector('[data-testid="insurances-delete-confirm"]') as HTMLButtonElement
      ).click();
      http.expectOne('/api/insurances/contracts/c1').flush(null);
      http.expectOne('/api/insurances').flush(base());
    });
  });

  describe('gap check', () => {
    it('reports missing, covered and dismissed per profile and contract', async () => {
      const settings = structuredClone(DEFAULT_SETTINGS);
      settings.profile.ownsProperty = true;
      settings.dismissedRequirements = ['LEGAL'];
      const f = await render(
        InsurancesGapCheckComponent,
        base({
          settings,
          contracts: [
            buildInsuranceContract({ id: 'h', type: 'HOUSEHOLD', name: 'Hausrat' }),
          ] as InsurancesData['contracts'],
        }),
      );
      expect(q(f, 'insurances-gap-missing-NATURAL_HAZARD')).not.toBeNull();
      expect(q(f, 'insurances-gap-covered-HOUSEHOLD')).not.toBeNull();
      expect(q(f, 'insurances-gap-dismissed-LEGAL')).not.toBeNull();
      expect(q(f, 'insurances-gap-note')).not.toBeNull();
    });

    it('saves a dismissal and a profile change', async () => {
      const f = await render(InsurancesGapCheckComponent, base());
      (q(f, 'insurances-gap-dismiss-LEGAL') as HTMLButtonElement).click();
      const put = http.expectOne('/api/insurances/settings');
      expect(
        (put.request.body as { dismissedRequirements: string[] }).dismissedRequirements,
      ).toEqual(['LEGAL']);
      put.flush({ ...DEFAULT_SETTINGS, dismissedRequirements: ['LEGAL'] });
      f.detectChanges();
      expect(q(f, 'insurances-gap-dismissed-LEGAL')).not.toBeNull();
    });
  });
});
