import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter, type Routes } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { buildRecord } from '@vaultfolio/retirement/testing';
import { RecordFormComponent } from './record-form.component';

const routes: Routes = [
  { path: 'app/retirement/new/:type', component: RecordFormComponent },
  { path: 'app/retirement/:id/edit', component: RecordFormComponent },
  { path: 'app/retirement/:pillar', component: RecordFormComponent },
];

describe('RecordFormComponent', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  const byTestId = (el: HTMLElement, id: string): HTMLInputElement | null =>
    el.querySelector(`[data-testid="${id}"]`);

  function type(el: HTMLElement, id: string, value: string): void {
    const input = byTestId(el, id) as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
  }

  it('adapts the fields to the chosen type', async () => {
    const harness = await RouterTestingHarness.create('/app/retirement/new/ALTERSVORSORGEDEPOT');
    const el = harness.routeNativeElement as HTMLElement;
    expect(byTestId(el, 'retirement-form-field-currentValue')).not.toBeNull();
    expect(byTestId(el, 'retirement-form-field-guaranteedMonthly')).toBeNull();
    expect(el.textContent).toContain('2027');
  });

  it('shows the inline error when the guarantee exceeds the expected pension', async () => {
    const harness = await RouterTestingHarness.create('/app/retirement/new/PENSIONSKASSE');
    const el = harness.routeNativeElement as HTMLElement;
    type(el, 'retirement-form-provider', 'Muster Kasse');
    type(el, 'retirement-form-statement-date', '2026-04-01');
    type(el, 'retirement-form-field-guaranteedMonthly', '300');
    type(el, 'retirement-form-field-expectedMonthly', '200');
    harness.detectChanges();
    byTestId(el, 'retirement-form-submit')?.click();
    harness.detectChanges();
    expect(http.match('/api/retirement/records')).toHaveLength(0);
    expect(byTestId(el, 'retirement-form-error-figures.guaranteedMonthly')).not.toBeNull();
  });

  it('posts a valid manual record and returns to the pillar tab', async () => {
    const harness = await RouterTestingHarness.create('/app/retirement/new/PENSIONSKASSE');
    const el = harness.routeNativeElement as HTMLElement;
    type(el, 'retirement-form-provider', 'Muster Kasse');
    type(el, 'retirement-form-statement-date', '2026-04-01');
    type(el, 'retirement-form-field-guaranteedMonthly', '100');
    type(el, 'retirement-form-field-expectedMonthly', '150');
    harness.detectChanges();
    byTestId(el, 'retirement-form-submit')?.click();
    const req = http.expectOne('/api/retirement/records');
    expect(req.request.method).toBe('POST');
    expect(req.request.body.contractType).toBe('PENSIONSKASSE');
    expect(req.request.body.origin).toBe('MANUAL');
    req.flush(buildRecord({ contractType: 'PENSIONSKASSE' }));
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/app/retirement/occupational');
  });

  it('shows only the supplement section for an imported record', async () => {
    const harness = await RouterTestingHarness.create('/app/retirement/abc/edit');
    http
      .expectOne('/api/retirement/records/abc')
      .flush(buildRecord({ id: 'abc', origin: 'IMPORTED', contractType: 'DIRECT_INSURANCE' }));
    await harness.fixture.whenStable();
    harness.detectChanges();
    const el = harness.routeNativeElement as HTMLElement;
    expect(byTestId(el, 'retirement-form-imported-note')).not.toBeNull();
    expect(byTestId(el, 'retirement-form-section-supplement')).not.toBeNull();
    expect(byTestId(el, 'retirement-form-field-guaranteedMonthly')).toBeNull();
  });
});
