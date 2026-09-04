import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { HoldingResponse } from '@vaultfolio/api-contract';
import { HoldingFormComponent } from './holding-form.component';

/**
 * Uses HttpClientTestingModule's mocked backend (via provideHttpClientTesting)
 * so this test requires no live backend server, matching
 * health-status.component.spec.ts's established pattern (User Story 3,
 * contracts/holdings-api.md).
 */
describe('HoldingFormComponent', () => {
  let fixture: ComponentFixture<HoldingFormComponent>;
  let component: HoldingFormComponent;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HoldingFormComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(HoldingFormComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('defaults to ETF field visibility in add mode (no ISIN/name field for... wait, ETF has isin/name)', () => {
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('ISIN');
    expect(text).toContain('Management');
    expect(text).not.toContain('Weight');
  });

  it('swaps the visible fields when the asset type changes to Precious metal', () => {
    component['form'].controls.assetType.setValue('PRECIOUS_METAL');
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Weight');
    expect(text).toContain('Name');
    expect(text).not.toContain('ISIN');
  });

  it('resets fields that no longer apply when switching asset type', () => {
    component['form'].controls.isin.setValue('IE00B4L5Y983');
    component['form'].controls.assetType.setValue('PRECIOUS_METAL');

    expect(component['form'].controls.isin.value).toBeNull();
  });

  it('never shows a purchase date field for ETF', () => {
    component['form'].controls.assetType.setValue('ETF');
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).not.toContain('Purchase date');
  });

  it('shows an optional purchase date field for Share', () => {
    component['form'].controls.assetType.setValue('SHARE');
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Purchase date');
  });

  it('blocks submit when the form is invalid, without calling the service', () => {
    component['form'].controls.assetType.setValue('CRYPTO');
    component['form'].controls.management.setValue('');
    fixture.detectChanges();

    component['submit']();

    httpMock.expectNone(() => true);
    expect(component['form'].controls.management.touched).toBe(true);
  });

  it('blocks submit for Precious metal with a blank name and shows the required-field message (FR-009)', () => {
    component['form'].setValue({
      assetType: 'PRECIOUS_METAL',
      management: 'Home safe',
      isin: null,
      name: '',
      quantity: null,
      purchasePrice: null,
      purchaseDate: null,
      weightGrams: 31.1,
      currentValue: null,
    });
    fixture.detectChanges();

    component['submit']();
    fixture.detectChanges();

    httpMock.expectNone(() => true);
    expect(component['form'].controls.name.touched).toBe(true);
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Name is required.');
  });

  it('blocks submit for Crypto with a blank name and shows the required-field message (Acceptance Scenario 2)', () => {
    component['form'].setValue({
      assetType: 'CRYPTO',
      management: 'Private',
      isin: null,
      name: '',
      quantity: 6.4,
      purchasePrice: 3150,
      purchaseDate: null,
      weightGrams: null,
      currentValue: null,
    });
    fixture.detectChanges();

    component['submit']();
    fixture.detectChanges();

    httpMock.expectNone(() => true);
    expect(component['form'].controls.name.touched).toBe(true);
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Name is required.');
  });

  it('submits a valid form and emits the created holding on success', () => {
    component['form'].setValue({
      assetType: 'CRYPTO',
      management: 'Private',
      isin: null,
      name: 'Bitcoin',
      quantity: 0.25,
      purchasePrice: 42000,
      purchaseDate: null,
      weightGrams: null,
      currentValue: null,
    });

    let emitted: HoldingResponse | undefined;
    component.saved.subscribe((holding) => (emitted = holding));
    component['submit']();

    const req = httpMock.expectOne('/api/holdings');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toMatchObject({
      assetType: 'CRYPTO',
      management: 'Private',
      name: 'Bitcoin',
    });

    const response: HoldingResponse = {
      id: 'new-id',
      assetType: 'CRYPTO',
      management: 'Private',
      quantity: '0.25',
      purchasePrice: '42000',
      purchaseDate: null,
      isin: null,
      name: 'Bitcoin',
      weightGrams: null,
      currentValue: null,
      createdAt: '2026-08-28T09:00:00.000Z',
      updatedAt: '2026-08-28T09:00:00.000Z',
    };
    req.flush(response);

    expect(emitted).toEqual(response);
  });

  describe('asset-type button/card selector (FR-012)', () => {
    it('renders a button per asset type, all visible at once, and selecting one updates the form', () => {
      const buttons = (fixture.nativeElement as HTMLElement).querySelectorAll(
        '.type-select .type-option',
      );
      expect(buttons).toHaveLength(4);

      const preciousMetalButton = Array.from(buttons).find((button) =>
        button.textContent?.includes('Precious metal'),
      ) as HTMLButtonElement;
      preciousMetalButton.click();
      fixture.detectChanges();

      expect(component['form'].controls.assetType.value).toBe('PRECIOUS_METAL');
      expect(preciousMetalButton.getAttribute('aria-pressed')).toBe('true');
    });
  });

  describe('edit mode', () => {
    const existing: HoldingResponse = {
      id: 'existing-id',
      assetType: 'CRYPTO',
      management: 'Private',
      quantity: '0.5',
      purchasePrice: '40000',
      purchaseDate: null,
      isin: null,
      name: 'Bitcoin',
      weightGrams: null,
      currentValue: null,
      createdAt: '2026-08-01T09:00:00.000Z',
      updatedAt: '2026-08-01T09:00:00.000Z',
    };

    beforeEach(() => {
      fixture.componentRef.setInput('holding', existing);
      fixture.detectChanges();
    });

    it('pre-fills the form with the holding’s values', () => {
      expect(component['form'].controls.management.value).toBe('Private');
      expect(component['form'].controls.quantity.value).toBe(0.5);
      expect(component['form'].controls.name.value).toBe('Bitcoin');
    });

    it('locks the asset type control', () => {
      expect(component['form'].controls.assetType.disabled).toBe(true);
    });

    it('shows the locked type as text, not the button/card selector', () => {
      const buttons = (fixture.nativeElement as HTMLElement).querySelectorAll(
        '.type-select .type-option[aria-pressed]',
      );
      expect(buttons).toHaveLength(0);
      const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
      expect(text).toContain('Crypto');
    });

    it('shows only the holding’s own type fields (no ISIN/weight for Crypto)', () => {
      const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
      expect(text).not.toContain('ISIN');
      expect(text).not.toContain('Weight');
    });

    it('cancel emits without calling the update endpoint', () => {
      let cancelled = false;
      component.cancelled.subscribe(() => (cancelled = true));

      component['cancel']();

      httpMock.expectNone(() => true);
      expect(cancelled).toBe(true);
    });

    it('blocks an invalid edit from being submitted', () => {
      component['form'].controls.quantity.setValue(-1);

      component['submit']();

      httpMock.expectNone(() => true);
    });

    it('submits a valid edit via PUT to the holding’s id', () => {
      component['form'].controls.quantity.setValue(0.75);

      component['submit']();

      const req = httpMock.expectOne('/api/holdings/existing-id');
      expect(req.request.method).toBe('PUT');
      req.flush({ ...existing, quantity: '0.75' });
    });
  });
});
