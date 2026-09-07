import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { SimpleChange } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { HoldingResponse } from '@vaultfolio/api-contract';
import { HoldingFormComponent } from './holding-form.component';

const VALID_ISIN = 'IE00B4L5Y983';

const makeHolding = (overrides: Partial<HoldingResponse> = {}): HoldingResponse => ({
  id: 'h-1',
  assetType: 'ETF',
  management: 'Roboadvisor',
  isin: VALID_ISIN,
  name: 'MSCI World',
  quantity: '12.5',
  purchasePrice: '78.42',
  purchaseDate: null,
  weightGrams: null,
  currentValue: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

describe('HoldingFormComponent', () => {
  let fixture: ComponentFixture<HoldingFormComponent>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HoldingFormComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(HoldingFormComponent);
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('initial state (add mode)', () => {
    it('defaults to ETF asset type', () => {
      expect(fixture.componentInstance['form'].controls.assetType.value).toBe('ETF');
    });

    it('isEditMode is false when no holding input', () => {
      expect(fixture.componentInstance.isEditMode).toBe(false);
    });

    it('management control is required (ETF)', () => {
      expect(fixture.componentInstance['isRequired']('management')).toBe(true);
    });

    it('isin control is required for ETF', () => {
      expect(fixture.componentInstance['isRequired']('isin')).toBe(true);
    });

    it('weightGrams is not required for ETF', () => {
      expect(fixture.componentInstance['isRequired']('weightGrams')).toBe(false);
    });

    it('currentValue is not required for ETF', () => {
      expect(fixture.componentInstance['isRequired']('currentValue')).toBe(false);
    });
  });

  describe('selectAssetType()', () => {
    it('switches fieldSet when a new type is selected in add mode', () => {
      fixture.componentInstance['selectAssetType']('DEPOSIT_MONEY');
      expect(fixture.componentInstance['fieldSet']().isin).toBe(false);
      expect(fixture.componentInstance['fieldSet']().currentValue).toBe(true);
    });

    it('does nothing in edit mode', () => {
      fixture.componentInstance.holding = makeHolding();
      fixture.componentInstance.ngOnChanges({
        holding: new SimpleChange(null, fixture.componentInstance.holding, false),
      });
      fixture.componentInstance['selectAssetType']('SHARE');
      expect(fixture.componentInstance['form'].controls.assetType.value).toBe('ETF');
    });

    it('resets inapplicable fields when switching type', () => {
      const comp = fixture.componentInstance;
      comp['form'].controls.isin.setValue(VALID_ISIN);
      comp['selectAssetType']('DEPOSIT_MONEY');
      expect(comp['form'].controls.isin.value).toBeNull();
    });
  });

  describe('ngOnChanges()', () => {
    it('populates the form from the holding in edit mode', () => {
      const holding = makeHolding({ management: 'Fidelity', isin: VALID_ISIN });
      fixture.componentInstance.holding = holding;
      fixture.componentInstance.ngOnChanges({
        holding: new SimpleChange(null, holding, false),
      });
      expect(fixture.componentInstance['form'].controls.management.value).toBe('Fidelity');
    });

    it('disables the assetType control in edit mode', () => {
      fixture.componentInstance.holding = makeHolding();
      fixture.componentInstance.ngOnChanges({
        holding: new SimpleChange(null, fixture.componentInstance.holding, false),
      });
      expect(fixture.componentInstance['form'].controls.assetType.disabled).toBe(true);
    });

    it('isEditMode is true when holding is set', () => {
      fixture.componentInstance.holding = makeHolding();
      fixture.componentInstance.ngOnChanges({
        holding: new SimpleChange(null, fixture.componentInstance.holding, false),
      });
      expect(fixture.componentInstance.isEditMode).toBe(true);
    });

    it('resets to add mode when holding is cleared', () => {
      fixture.componentInstance.holding = makeHolding();
      fixture.componentInstance.ngOnChanges({
        holding: new SimpleChange(null, fixture.componentInstance.holding, false),
      });
      fixture.componentInstance.holding = null;
      fixture.componentInstance.ngOnChanges({
        holding: new SimpleChange(makeHolding(), null, false),
      });
      expect(fixture.componentInstance.isEditMode).toBe(false);
      expect(fixture.componentInstance['form'].controls.assetType.enabled).toBe(true);
    });

    it('converts purchaseDate string to Date in edit mode', () => {
      const holding = makeHolding({ assetType: 'SHARE', purchaseDate: '2025-06-15' });
      fixture.componentInstance.holding = holding;
      fixture.componentInstance.ngOnChanges({
        holding: new SimpleChange(null, holding, false),
      });
      const val = fixture.componentInstance['form'].controls.purchaseDate.value;
      expect(val).toBeInstanceOf(Date);
    });

    it('ignores ngOnChanges if holding key is absent', () => {
      const before = fixture.componentInstance['form'].controls.management.value;
      fixture.componentInstance.ngOnChanges({});
      expect(fixture.componentInstance['form'].controls.management.value).toBe(before);
    });
  });

  describe('submit() — add mode', () => {
    it('marks all controls touched but makes no request when form is invalid', () => {
      fixture.componentInstance['submit']();
      httpMock.expectNone('/api/holdings');
      expect(fixture.componentInstance['form'].touched).toBe(true);
    });

    it('POSTs to /api/holdings with valid ETF data', () => {
      const comp = fixture.componentInstance;
      comp['form'].controls.management.setValue('Vanguard');
      comp['form'].controls.isin.setValue(VALID_ISIN);
      comp['form'].controls.name.setValue('MSCI World');
      comp['form'].controls.quantity.setValue(10);
      comp['form'].controls.purchasePrice.setValue(80);
      comp['submit']();
      const req = httpMock.expectOne('/api/holdings');
      expect(req.request.method).toBe('POST');
      req.flush(makeHolding());
      expect(comp['submitting']()).toBe(false);
    });

    it('emits saved after a successful create', () => {
      const comp = fixture.componentInstance;
      comp['form'].controls.management.setValue('Vanguard');
      comp['form'].controls.isin.setValue(VALID_ISIN);
      comp['form'].controls.name.setValue('MSCI World');
      comp['form'].controls.quantity.setValue(10);
      comp['form'].controls.purchasePrice.setValue(80);
      const saved: HoldingResponse[] = [];
      comp.saved.subscribe((h) => saved.push(h));
      comp['submit']();
      httpMock.expectOne('/api/holdings').flush(makeHolding());
      expect(saved).toHaveLength(1);
    });

    it('sets submitError and clears submitting on server error', () => {
      const comp = fixture.componentInstance;
      comp['form'].controls.management.setValue('Vanguard');
      comp['form'].controls.isin.setValue(VALID_ISIN);
      comp['form'].controls.name.setValue('MSCI World');
      comp['form'].controls.quantity.setValue(10);
      comp['form'].controls.purchasePrice.setValue(80);
      comp['submit']();
      httpMock.expectOne('/api/holdings').error(new ProgressEvent('error'), { status: 500 });
      expect(comp['submitError']()).toBeTruthy();
      expect(comp['submitting']()).toBe(false);
    });

    it('extracts field-level errors from the server response', () => {
      const comp = fixture.componentInstance;
      comp['form'].controls.management.setValue('Vanguard');
      comp['form'].controls.isin.setValue(VALID_ISIN);
      comp['form'].controls.name.setValue('MSCI World');
      comp['form'].controls.quantity.setValue(10);
      comp['form'].controls.purchasePrice.setValue(80);
      comp['submit']();
      httpMock
        .expectOne('/api/holdings')
        .flush(
          { fieldErrors: [{ field: 'isin', message: 'Invalid ISIN' }] },
          { status: 422, statusText: 'Unprocessable Entity' },
        );
      expect(comp['submitError']()).toBe('Invalid ISIN');
    });
  });

  describe('submit() — edit mode', () => {
    beforeEach(() => {
      fixture.componentInstance.holding = makeHolding({ id: 'h-1' });
      fixture.componentInstance.ngOnChanges({
        holding: new SimpleChange(null, fixture.componentInstance.holding, false),
      });
    });

    it('PUTs to /api/holdings/:id', () => {
      const comp = fixture.componentInstance;
      comp['form'].controls.management.setValue('Updated');
      comp['submit']();
      const req = httpMock.expectOne('/api/holdings/h-1');
      expect(req.request.method).toBe('PUT');
      req.flush(makeHolding({ management: 'Updated' }));
    });
  });

  describe('cancel()', () => {
    it('emits cancelled', () => {
      let emitted = false;
      fixture.componentInstance.cancelled.subscribe(() => (emitted = true));
      fixture.componentInstance['cancel']();
      expect(emitted).toBe(true);
    });
  });

  describe('DEPOSIT_MONEY field set', () => {
    beforeEach(() => {
      fixture.componentInstance['selectAssetType']('DEPOSIT_MONEY');
    });

    it('currentValue is required for DEPOSIT_MONEY', () => {
      expect(fixture.componentInstance['isRequired']('currentValue')).toBe(true);
    });

    it('quantity is not required for DEPOSIT_MONEY', () => {
      expect(fixture.componentInstance['isRequired']('quantity')).toBe(false);
    });

    it('accepts currentValue of 0 (non-negative)', () => {
      const comp = fixture.componentInstance;
      comp['form'].controls.management.setValue('Bank');
      comp['form'].controls.name.setValue('Savings');
      comp['form'].controls.currentValue.setValue(0);
      comp['submit']();
      const req = httpMock.expectOne('/api/holdings');
      expect(req.request.body['currentValue']).toBe('0');
      req.flush(makeHolding({ assetType: 'DEPOSIT_MONEY' }));
    });
  });

  describe('SHARE field set', () => {
    beforeEach(() => {
      fixture.componentInstance['selectAssetType']('SHARE');
    });

    it('shows purchaseDate field for SHARE', () => {
      expect(fixture.componentInstance['fieldSet']().purchaseDate).toBe('optional');
    });

    it('includes purchaseDate in request body when set', () => {
      const comp = fixture.componentInstance;
      comp['form'].controls.management.setValue('Broker');
      comp['form'].controls.isin.setValue(VALID_ISIN);
      comp['form'].controls.name.setValue('Apple');
      comp['form'].controls.quantity.setValue(5);
      comp['form'].controls.purchasePrice.setValue(150);
      comp['form'].controls.purchaseDate.setValue(new Date('2025-03-15'));
      comp['submit']();
      const req = httpMock.expectOne('/api/holdings');
      expect(req.request.body['purchaseDate']).toBe('2025-03-15');
      req.flush(makeHolding({ assetType: 'SHARE' }));
    });
  });

  describe('PRECIOUS_METAL field set', () => {
    beforeEach(() => {
      fixture.componentInstance['selectAssetType']('PRECIOUS_METAL');
    });

    it('currentValue is optional (not required) for PRECIOUS_METAL', () => {
      expect(fixture.componentInstance['isRequired']('currentValue')).toBe(false);
    });

    it('weightGrams is required for PRECIOUS_METAL', () => {
      expect(fixture.componentInstance['isRequired']('weightGrams')).toBe(true);
    });
  });

  describe('iconFor() / labelFor() / namePlaceholderKey()', () => {
    it('iconFor returns a non-empty string for each asset type', () => {
      const comp = fixture.componentInstance;
      for (const type of ['ETF', 'SHARE', 'PRECIOUS_METAL', 'CRYPTO', 'DEPOSIT_MONEY'] as const) {
        expect(comp['iconFor'](type)).toBeTruthy();
      }
    });

    it('namePlaceholderKey returns a translation key for current asset type', () => {
      expect(fixture.componentInstance['namePlaceholderKey']()).toBeTruthy();
    });
  });

  describe('dateFormat()', () => {
    it('returns mm/dd/yy for non-German locale', () => {
      expect(fixture.componentInstance['dateFormat']()).toBe('mm/dd/yy');
    });
  });
});
