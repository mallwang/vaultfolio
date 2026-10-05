import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CURRENT_USER_SOURCE } from '@vaultfolio/frontend-domain-access';
import type { InsurancesData } from '@vaultfolio/api-contract';
import { buildInsuranceContract } from '@vaultfolio/insurances/testing';
import { DEFAULT_SETTINGS } from '@vaultfolio/insurances';
import { InsurancesDashboardWidgetComponent } from './insurances-dashboard-widget.component';

const data = (over: Partial<InsurancesData> = {}): InsurancesData => ({
  contracts: [],
  linkedSocial: [],
  settings: structuredClone(DEFAULT_SETTINGS),
  today: '2026-09-10',
  ...over,
});

describe('InsurancesDashboardWidgetComponent', () => {
  let http: HttpTestingController;

  beforeEach(() => {
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

  async function render(body: InsurancesData | 503) {
    const fixture = TestBed.createComponent(InsurancesDashboardWidgetComponent);
    fixture.detectChanges();
    const req = http.expectOne('/api/insurances');
    if (body === 503)
      req.flush({ error: 'INSURANCES_UNAVAILABLE' }, { status: 503, statusText: 'x' });
    else req.flush(body);
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  const q = (el: HTMLElement, id: string) => el.querySelector(`[data-testid="${id}"]`);
  const txt = (el: HTMLElement, id: string) => q(el, id)?.textContent?.replace(/\s+/g, ' ').trim();

  it('shows monthly cost, yearly cost and the next deadline', async () => {
    const el = await render(
      data({
        contracts: [
          buildInsuranceContract({
            id: 'c1',
            name: 'Haftpflicht',
            endDate: '2026-12-31',
            cancellation: { autoRenew: true, period: { value: 3, unit: 'MONTHS' } },
          }),
        ] as InsurancesData['contracts'],
      }),
    );
    expect(txt(el, 'insurances-widget-monthly')).toContain('8.00');
    expect(txt(el, 'insurances-widget-yearly')).toContain('96.00');
    expect(txt(el, 'insurances-widget-next')).toContain('Haftpflicht');
    expect(q(el, 'insurances-widget-next')?.classList).toContain('warn');
  });

  it('invites to add the first contract without data', async () => {
    const el = await render(data());
    expect(q(el, 'insurances-widget-empty')).not.toBeNull();
  });

  it('degrades to a note when unavailable', async () => {
    const el = await render(503);
    expect(q(el, 'insurances-widget-unavailable')).not.toBeNull();
  });
});
