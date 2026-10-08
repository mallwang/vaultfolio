import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { SimpleChange } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { HoldingResponse } from '@vaultfolio/api-contract';
import { I18nService } from '@vaultfolio/frontend-shared-ui';
import { HoldingFormComponent } from './holding-form.component';

const VALID_ISIN = 'IE00B4L5Y983';

const makeHolding = (overrides: Partial<HoldingResponse> = {}): HoldingResponse => ({
  id: 'h-1',
  assetType: 'ETF',
  management: 'Roboadvisor',
  note: null,
  isin: VALID_ISIN,
  name: 'MSCI World',
  metal: null,
  coinId: null,
  quantity: '12.5',
  unit: null,
  purchasePrice: '78.42',
  purchaseDate: null,
  currentValue: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

describe('HoldingFormComponent', () => {
  let fixture: ComponentFixture<HoldingFormComponent>;
  let httpMock: HttpTestingController;
  let i18n: I18nService;

  const el = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const byId = (id: string): HTMLElement | null => el().querySelector(`[data-testid="${id}"]`);
  const form = () => fixture.componentInstance['form'];
  const submit = (): void => {
    fixture.componentInstance['submit']();
    fixture.detectChanges();
  };
  const selectType = (type: string): void => {
    form().controls.assetType.setValue(type as never);
    fixture.detectChanges();
  };
  const edit = (holding: HoldingResponse): void => {
    fixture.componentRef.setInput('holding', holding);
    fixture.componentInstance.ngOnChanges({ holding: new SimpleChange(null, holding, true) });
    fixture.detectChanges();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HoldingFormComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    i18n = TestBed.inject(I18nService);
    i18n.setLanguage('en');
    fixture = TestBed.createComponent(HoldingFormComponent);
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => httpMock.verify());

  it.each([
    ['ETF', ['isin', 'name', 'quantity', 'purchase-price', 'management', 'note']],
    [
      'SHARE',
      ['isin', 'name', 'quantity', 'purchase-price', 'purchase-date', 'management', 'note'],
    ],
    ['PRECIOUS_METAL', ['metal', 'quantity', 'unit', 'current-value', 'management', 'note']],
    ['CRYPTO', ['coin', 'quantity', 'purchase-price', 'purchase-date', 'management', 'note']],
    ['DEPOSIT_MONEY', ['name', 'current-value', 'management', 'note']],
  ])('%s shows exactly its own fields', (type, expected) => {
    selectType(type);
    const all = [
      'isin',
      'name',
      'metal',
      'coin',
      'quantity',
      'unit',
      'purchase-price',
      'purchase-date',
      'current-value',
      'management',
      'note',
    ];
    expect(all.filter((id) => byId(`holding-form-${id}`))).toEqual(
      all.filter((id) => expected.includes(id)),
    );
  });

  it('offers exactly 4 metals with translated names, in German too', () => {
    const labels = () =>
      fixture.componentInstance['metalOptions']().map((o: { label: string }) => o.label);
    expect(labels()).toEqual(['Gold', 'Silver', 'Platinum', 'Palladium']);
    i18n.setLanguage('de');
    expect(labels()).toEqual(['Gold', 'Silber', 'Platin', 'Palladium']);
  });

  it('coin options carry name and symbol for filtering', () => {
    const bitcoin = fixture.componentInstance['coinOptions'].find(
      (c: { id: string }) => c.id === 'bitcoin',
    );
    expect(bitcoin).toMatchObject({ name: 'Bitcoin', symbol: 'BTC', label: 'Bitcoin (BTC)' });
  });

  it('shows the note counter while typing', () => {
    const note = byId('holding-form-note') as HTMLTextAreaElement;
    note.value = 'hello';
    note.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(el().textContent).toContain('5 / 500');
  });

  it('POSTs an ETF with decimals as strings and optional fields omitted', () => {
    form().patchValue({
      management: 'Roboadvisor',
      isin: 'ie00b4l5y983',
      name: 'MSCI World',
      quantity: 12.5,
      purchasePrice: 78.42,
    });
    submit();
    const req = httpMock.expectOne('/api/holdings');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      assetType: 'ETF',
      management: 'Roboadvisor',
      isin: VALID_ISIN,
      name: 'MSCI World',
      quantity: '12.5',
      purchasePrice: '78.42',
    });
    req.flush(makeHolding());
  });

  it('POSTs a metal with metal code and unit, no name', () => {
    selectType('PRECIOUS_METAL');
    form().patchValue({
      management: 'Vault',
      metal: 'XAU',
      quantity: 2,
      unit: 'OZT',
      name: 'ignored',
    });
    submit();
    const req = httpMock.expectOne('/api/holdings');
    expect(req.request.body).toEqual({
      assetType: 'PRECIOUS_METAL',
      management: 'Vault',
      metal: 'XAU',
      quantity: '2',
      unit: 'OZT',
    });
    req.flush(makeHolding());
  });

  it('POSTs a crypto purchase date as YYYY-MM-DD', () => {
    selectType('CRYPTO');
    form().patchValue({
      management: 'Wallet',
      coinId: 'bitcoin',
      quantity: 0.1,
      purchasePrice: 30000,
      purchaseDate: new Date(2024, 0, 5),
    });
    submit();
    const req = httpMock.expectOne('/api/holdings');
    expect(req.request.body).toEqual({
      assetType: 'CRYPTO',
      management: 'Wallet',
      coinId: 'bitcoin',
      quantity: '0.1',
      purchasePrice: '30000',
      purchaseDate: '2024-01-05',
    });
    req.flush(makeHolding());
  });

  it('does not call the API and shows the mapped message when client validation fails', () => {
    form().patchValue({ management: 'X', isin: 'BAD', name: 'N', quantity: 1, purchasePrice: 1 });
    submit();
    httpMock.expectNone('/api/holdings');
    expect(byId('holding-form-isin-error')?.textContent).toContain(
      'Enter a well-formed 12-character ISIN.',
    );
  });

  it('shows required errors per field, in German when the language is de', () => {
    i18n.setLanguage('de');
    submit();
    httpMock.expectNone('/api/holdings');
    expect(byId('holding-form-isin-error')?.textContent).toContain(
      i18n.translate('holdingError.REQUIRED'),
    );
    expect(i18n.translate('holdingError.REQUIRED')).not.toBe('holdingError.REQUIRED');
  });

  it.each([
    ['FIELD_NOT_ALLOWED', 'This field is not allowed for this asset type.'],
    [
      'DECIMAL_INVALID',
      'Enter a valid, non-negative amount or a valid date that is not in the future.',
    ],
    ['COIN_UNKNOWN', 'Select one of the listed coins.'],
  ])('maps server code %s onto its field in English', (code, message) => {
    selectType('CRYPTO');
    form().patchValue({ management: 'W', coinId: 'bitcoin', quantity: 1, purchasePrice: 1 });
    submit();
    httpMock
      .expectOne('/api/holdings')
      .flush(
        { message: 'One or more fields are invalid.', errors: [{ field: 'purchasePrice', code }] },
        { status: 400, statusText: 'Bad Request' },
      );
    fixture.detectChanges();
    expect(byId('holding-form-purchase-price-error')?.textContent).toContain(message);
  });

  it('maps a server code to the German message', () => {
    i18n.setLanguage('de');
    form().patchValue({
      management: 'B',
      isin: VALID_ISIN,
      name: 'N',
      quantity: 1,
      purchasePrice: 1,
    });
    submit();
    httpMock
      .expectOne('/api/holdings')
      .flush(
        { message: 'x', errors: [{ field: 'isin', code: 'ISIN_NOT_ALLOWED' }] },
        { status: 400, statusText: 'Bad Request' },
      );
    fixture.detectChanges();
    const text = byId('holding-form-isin-error')?.textContent ?? '';
    expect(text).toContain(i18n.translate('holdingError.ISIN_NOT_ALLOWED'));
    expect(text).not.toContain('holdingError.');
  });

  it('shows a generic error for a non-validation failure', () => {
    form().patchValue({
      management: 'B',
      isin: VALID_ISIN,
      name: 'N',
      quantity: 1,
      purchasePrice: 1,
    });
    submit();
    httpMock.expectOne('/api/holdings').flush({}, { status: 503, statusText: 'Unavailable' });
    fixture.detectChanges();
    expect(byId('holding-form-error')?.textContent).toContain('Unable to save this holding');
  });

  describe('edit mode', () => {
    it('disables the asset type and PUTs without assetType', () => {
      edit(makeHolding());
      expect(form().controls.assetType.disabled).toBe(true);
      expect(byId('holding-form-type-SHARE')).toBeNull();
      form().patchValue({ quantity: 20 });
      submit();
      const req = httpMock.expectOne('/api/holdings/h-1');
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual({
        management: 'Roboadvisor',
        isin: VALID_ISIN,
        name: 'MSCI World',
        quantity: '20',
        purchasePrice: '78.42',
      });
      req.flush(makeHolding({ quantity: '20' }));
    });

    it('prefills a metal holding including unit and note', () => {
      edit(
        makeHolding({
          assetType: 'PRECIOUS_METAL',
          isin: null,
          name: null,
          metal: 'XAG',
          quantity: '5',
          unit: 'OZT',
          purchasePrice: null,
          note: 'safe',
        }),
      );
      expect(form().getRawValue()).toMatchObject({
        assetType: 'PRECIOUS_METAL',
        metal: 'XAG',
        quantity: 5,
        unit: 'OZT',
        note: 'safe',
      });
    });
  });
});
