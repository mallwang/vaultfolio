import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CURRENT_USER_SOURCE } from '@vaultfolio/frontend-domain-access';
import type { InsurancesData } from '@vaultfolio/api-contract';
import { DEFAULT_SETTINGS } from '@vaultfolio/insurances';
import { InsurancesContractFormComponent } from './contract-form.component';

const data = (): InsurancesData => ({
  contracts: [],
  linkedSocial: [],
  settings: structuredClone(DEFAULT_SETTINGS),
  today: '2026-09-10',
});

describe('InsurancesContractFormComponent', () => {
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

  async function render() {
    const fixture = TestBed.createComponent(InsurancesContractFormComponent);
    fixture.detectChanges();
    http.expectOne('/api/insurances').flush(data());
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  const q = (el: HTMLElement, id: string) => el.querySelector(`[data-testid="${id}"]`);

  function type(el: HTMLElement, id: string, value: string) {
    const input = q(el, id) as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
  }

  it('shows inline errors instead of sending an invalid contract', async () => {
    const fixture = await render();
    const el = fixture.nativeElement as HTMLElement;
    (q(el, 'insurances-form-save') as HTMLButtonElement).click();
    fixture.detectChanges();
    http.expectNone('/api/insurances/contracts');
    expect(q(el, 'insurances-form-type-error')).not.toBeNull();
    expect(q(el, 'insurances-form-name-error')).not.toBeNull();
    expect(q(el, 'insurances-form-premium-error')).not.toBeNull();
  });

  it('shows the derived cost live and posts a valid contract', async () => {
    const fixture = await render();
    const el = fixture.nativeElement as HTMLElement;
    const form = fixture.componentInstance as unknown as {
      setType(type: string): void;
    };
    form.setType('PRIVATE_LIABILITY');
    fixture.detectChanges();
    await fixture.whenStable();
    type(el, 'insurances-form-premium', '96,00');
    fixture.detectChanges();
    expect(q(el, 'insurances-form-derived-monthly')?.textContent).toContain('8.00');
    expect(q(el, 'insurances-form-derived-yearly')?.textContent).toContain('96.00');

    (q(el, 'insurances-form-save') as HTMLButtonElement).click();
    const post = http.expectOne('/api/insurances/contracts');
    expect(post.request.body).toMatchObject({
      type: 'PRIVATE_LIABILITY',
      premium: '96.00',
      interval: 'YEARLY',
      status: 'ACTIVE',
      cancellation: { autoRenew: true },
    });
    post.flush({ id: 'c1' });
    http.expectOne('/api/insurances').flush(data());
  });

  it('maps a server validation error back to its field', async () => {
    const fixture = await render();
    const el = fixture.nativeElement as HTMLElement;
    (fixture.componentInstance as unknown as { setType(type: string): void }).setType('CAR');
    fixture.detectChanges();
    await fixture.whenStable();
    type(el, 'insurances-form-premium', '10');
    fixture.detectChanges();
    (q(el, 'insurances-form-save') as HTMLButtonElement).click();
    http
      .expectOne('/api/insurances/contracts')
      .flush(
        { error: 'INSURANCES_VALIDATION', details: [{ field: 'premium', message: 'INVALID' }] },
        { status: 400, statusText: 'x' },
      );
    fixture.detectChanges();
    expect(q(el, 'insurances-form-save-error')).not.toBeNull();
    expect(q(el, 'insurances-form-premium-error')).not.toBeNull();
  });
});
