import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CURRENT_USER_SOURCE } from '@vaultfolio/frontend-domain-access';
import type { InsurancesData } from '@vaultfolio/api-contract';
import { DEFAULT_SETTINGS } from '@vaultfolio/insurances';
import { buildInsuranceContract } from '@vaultfolio/insurances/testing';
import { InsurancesRemindersComponent } from '../reminders/reminders.component';
import { InsurancesAreaComponent } from './insurances-area.component';
import { InsurancesDangerZoneComponent } from './insurances-danger-zone.component';
import { InsurancesUnavailableComponent } from './insurances-unavailable.component';

const data = (over: Partial<InsurancesData> = {}): InsurancesData => ({
  contracts: [buildInsuranceContract({ id: 'c1' })] as InsurancesData['contracts'],
  linkedSocial: [],
  settings: structuredClone(DEFAULT_SETTINGS),
  today: '2026-09-10',
  ...over,
});

describe('insurances area rendering', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    vi.stubGlobal(
      'ResizeObserver',
      vi.fn(function () {
        return { observe: vi.fn(), unobserve: vi.fn(), disconnect: vi.fn() };
      }),
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

  const q = (el: HTMLElement, id: string) => el.querySelector(`[data-testid="${id}"]`);

  it('renders the unavailable state', () => {
    const fixture = TestBed.createComponent(InsurancesUnavailableComponent);
    fixture.detectChanges();
    expect(q(fixture.nativeElement, 'insurances-unavailable')).not.toBeNull();
  });

  it('renders the danger zone and opens the confirmation', () => {
    const fixture = TestBed.createComponent(InsurancesDangerZoneComponent);
    fixture.detectChanges();
    expect(q(fixture.nativeElement, 'insurances-danger-zone')).not.toBeNull();
    (q(fixture.nativeElement, 'insurances-delete-all') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.componentInstance['open']()).toBe(true);
  });

  it('renders the area toolbar, tabs and danger zone', async () => {
    const fixture = TestBed.createComponent(InsurancesAreaComponent);
    fixture.detectChanges();
    http.expectOne('/api/insurances').flush(data());
    await fixture.whenStable();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(q(el, 'insurances-add-button')).not.toBeNull();
    expect(q(el, 'insurances-tab-gap-check')).not.toBeNull();
    expect(q(el, 'insurances-danger-zone')).not.toBeNull();
    (q(el, 'insurances-reminders-link') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.componentInstance['remindersOpen']()).toBe(true);
  });

  it('shows only the unavailable state when the key is missing', async () => {
    const fixture = TestBed.createComponent(InsurancesAreaComponent);
    fixture.detectChanges();
    http
      .expectOne('/api/insurances')
      .flush({ error: 'INSURANCES_UNAVAILABLE' }, { status: 503, statusText: 'x' });
    await fixture.whenStable();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(q(el, 'insurances-unavailable')).not.toBeNull();
    expect(q(el, 'insurances-add-button')).toBeNull();
  });

  it('renders the reminders dialog rows', async () => {
    const fixture = TestBed.createComponent(InsurancesRemindersComponent);
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();
    http.expectOne('/api/insurances').flush(data());
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.componentInstance['contracts']()).toHaveLength(1);
    expect(document.querySelector('[data-testid="insurances-reminders-dialog"]')).not.toBeNull();
  });
});
