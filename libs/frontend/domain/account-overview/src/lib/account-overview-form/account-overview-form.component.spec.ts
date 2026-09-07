import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { SimpleChange } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { AccountOverviewEntry } from '@vaultfolio/api-contract';
import { AccountOverviewFormComponent } from './account-overview-form.component';

const makeAccount = (overrides: Partial<AccountOverviewEntry> = {}): AccountOverviewEntry => ({
  id: 'a1',
  name: 'N26 Checking',
  category: 'SAVINGS',
  status: 'ACTIVE',
  provider: null,
  website: null,
  purpose: null,
  cardUsage: null,
  requiredMinimum: null,
  notes: null,
  cardNumber: null,
  validUntil: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

describe('AccountOverviewFormComponent', () => {
  let fixture: ComponentFixture<AccountOverviewFormComponent>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AccountOverviewFormComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(AccountOverviewFormComponent);
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('rejects a blank-name submission with an inline error and makes no HTTP call', () => {
    fixture.componentInstance['form'].controls.name.setValue('');
    fixture.detectChanges();

    (fixture.nativeElement as HTMLElement)
      .querySelector('form')
      ?.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    const error = (fixture.nativeElement as HTMLElement).querySelector(
      '[data-testid="account-overview-form-name-error"]',
    );
    expect(error).not.toBeNull();
    httpMock.expectNone('/api/account-overview/accounts');
  });

  it('submits the expected create payload when fully filled in', () => {
    const form = fixture.componentInstance['form'];
    form.setValue({
      name: 'N26 checking',
      category: 'SAVINGS',
      status: 'ACTIVE',
      provider: 'N26',
      website: 'https://n26.com',
      purpose: 'Everyday spending',
      cardUsage: 'Contactless only',
      requiredMinimum: 500,
      notes: 'Shared with partner',
      cardNumber: null,
      validUntil: null,
    });
    fixture.detectChanges();

    (fixture.nativeElement as HTMLElement)
      .querySelector('form')
      ?.dispatchEvent(new Event('submit'));

    const req = httpMock.expectOne('/api/account-overview/accounts');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      name: 'N26 checking',
      category: 'SAVINGS',
      status: 'ACTIVE',
      provider: 'N26',
      website: 'https://n26.com',
      purpose: 'Everyday spending',
      cardUsage: 'Contactless only',
      requiredMinimum: '500',
      notes: 'Shared with partner',
      cardNumber: undefined,
      validUntil: undefined,
    });

    const response: AccountOverviewEntry = {
      id: 'a1',
      name: 'N26 checking',
      category: 'SAVINGS',
      status: 'ACTIVE',
      provider: 'N26',
      website: 'https://n26.com',
      purpose: 'Everyday spending',
      cardUsage: 'Contactless only',
      requiredMinimum: '500',
      notes: 'Shared with partner',
      cardNumber: null,
      validUntil: null,
      createdAt: '2026-08-01T09:00:00.000Z',
      updatedAt: '2026-08-01T09:00:00.000Z',
    };
    req.flush(response, { status: 201, statusText: 'Created' });
  });

  it('rejects a malformed website with an inline error and makes no HTTP call', () => {
    const form = fixture.componentInstance['form'];
    form.controls.name.setValue('N26 checking');
    form.controls.website.setValue('not-a-url');
    form.controls.website.markAsTouched();
    fixture.detectChanges();

    (fixture.nativeElement as HTMLElement)
      .querySelector('form')
      ?.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    const error = (fixture.nativeElement as HTMLElement).querySelector(
      '[data-testid="account-overview-form-website-error"]',
    );
    expect(error).not.toBeNull();
    httpMock.expectNone('/api/account-overview/accounts');
  });

  it('rejects a negative required minimum with an inline error and makes no HTTP call', () => {
    const form = fixture.componentInstance['form'];
    form.controls.name.setValue('N26 checking');
    form.controls.requiredMinimum.setValue(-100);
    form.controls.requiredMinimum.markAsTouched();
    fixture.detectChanges();

    (fixture.nativeElement as HTMLElement)
      .querySelector('form')
      ?.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    const error = (fixture.nativeElement as HTMLElement).querySelector(
      '[data-testid="account-overview-form-required-minimum-error"]',
    );
    expect(error).not.toBeNull();
    httpMock.expectNone('/api/account-overview/accounts');
  });

  it('shows and validates the card-number/valid-until fields only for a CREDIT_CARD account', () => {
    const form = fixture.componentInstance['form'];
    const nativeElement = fixture.nativeElement as HTMLElement;

    expect(
      nativeElement.querySelector('[data-testid="account-overview-form-card-number"]'),
    ).toBeNull();

    form.controls.category.setValue('CREDIT_CARD');
    fixture.detectChanges();

    expect(
      nativeElement.querySelector('[data-testid="account-overview-form-card-number"]'),
    ).not.toBeNull();

    form.controls.validUntil.setValue('2028');
    form.controls.validUntil.markAsTouched();
    fixture.detectChanges();
    expect(
      nativeElement.querySelector('[data-testid="account-overview-form-valid-until-error"]'),
    ).not.toBeNull();

    form.controls.validUntil.setValue('09/28');
    fixture.detectChanges();
    expect(
      nativeElement.querySelector('[data-testid="account-overview-form-valid-until-error"]'),
    ).toBeNull();
  });

  it('submits an update request in edit mode', () => {
    const account: AccountOverviewEntry = {
      id: 'a1',
      name: 'N26 checking',
      category: 'GENERAL',
      status: 'ACTIVE',
      provider: null,
      website: null,
      purpose: null,
      cardUsage: null,
      requiredMinimum: null,
      notes: null,
      cardNumber: null,
      validUntil: null,
      createdAt: '2026-08-01T09:00:00.000Z',
      updatedAt: '2026-08-01T09:00:00.000Z',
    };
    fixture.componentRef.setInput('account', account);
    fixture.detectChanges();

    (fixture.nativeElement as HTMLElement)
      .querySelector('form')
      ?.dispatchEvent(new Event('submit'));

    const req = httpMock.expectOne('/api/account-overview/accounts/a1');
    expect(req.request.method).toBe('PUT');
    req.flush({ ...account });
  });

  it('defaults status to ACTIVE and includes it in the create payload', () => {
    const form = fixture.componentInstance['form'];
    expect(form.controls.status.value).toBe('ACTIVE');

    form.controls.name.setValue('N26 checking');
    form.controls.status.setValue('DECOMMISSIONED');
    fixture.detectChanges();

    (fixture.nativeElement as HTMLElement)
      .querySelector('form')
      ?.dispatchEvent(new Event('submit'));

    const req = httpMock.expectOne('/api/account-overview/accounts');
    expect(req.request.body).toMatchObject({ status: 'DECOMMISSIONED' });
    req.flush({ id: 'a1' });
  });

  describe('ngOnChanges()', () => {
    it('populates form from account in edit mode', () => {
      const account = makeAccount({ name: 'Savings', provider: 'N26', requiredMinimum: '1000' });
      fixture.componentInstance.account = account;
      fixture.componentInstance.ngOnChanges({
        account: new SimpleChange(null, account, false),
      });
      expect(fixture.componentInstance['form'].controls.name.value).toBe('Savings');
      expect(fixture.componentInstance['form'].controls.provider.value).toBe('N26');
      expect(fixture.componentInstance['form'].controls.requiredMinimum.value).toBe(1000);
    });

    it('resets to add mode when account is cleared', () => {
      const account = makeAccount({ name: 'Savings' });
      fixture.componentInstance.account = account;
      fixture.componentInstance.ngOnChanges({
        account: new SimpleChange(null, account, false),
      });
      fixture.componentInstance.account = null;
      fixture.componentInstance.ngOnChanges({
        account: new SimpleChange(account, null, false),
      });
      expect(fixture.componentInstance.isEditMode).toBe(false);
      expect(fixture.componentInstance['form'].controls.name.value).toBe('');
    });

    it('ignores ngOnChanges if account key is absent', () => {
      const before = fixture.componentInstance['form'].controls.name.value;
      fixture.componentInstance.ngOnChanges({});
      expect(fixture.componentInstance['form'].controls.name.value).toBe(before);
    });

    it('clears submitError on account change', () => {
      fixture.componentInstance['submitError'].set('old error');
      fixture.componentInstance.account = makeAccount();
      fixture.componentInstance.ngOnChanges({
        account: new SimpleChange(null, fixture.componentInstance.account, false),
      });
      expect(fixture.componentInstance['submitError']()).toBeNull();
    });
  });

  describe('isEditMode', () => {
    it('is false when account is null', () => {
      expect(fixture.componentInstance.isEditMode).toBe(false);
    });

    it('is true when account is set', () => {
      fixture.componentInstance.account = makeAccount();
      expect(fixture.componentInstance.isEditMode).toBe(true);
    });
  });

  describe('labelFor() / statusLabelFor()', () => {
    it('labelFor returns a non-empty string for SAVINGS', () => {
      expect(fixture.componentInstance['labelFor']('SAVINGS')).toBeTruthy();
    });

    it('statusLabelFor returns a non-empty string for ACTIVE', () => {
      expect(fixture.componentInstance['statusLabelFor']('ACTIVE')).toBeTruthy();
    });
  });

  describe('onCardNumberInput() / onValidUntilInput()', () => {
    it('formats and sets card number on input', () => {
      const input = document.createElement('input');
      input.value = '4111111111111111';
      fixture.componentInstance['onCardNumberInput']({ target: input } as unknown as Event);
      expect(fixture.componentInstance['form'].controls.cardNumber.value).toContain('4111');
    });

    it('formats and sets validUntil on input', () => {
      const input = document.createElement('input');
      input.value = '1228';
      fixture.componentInstance['onValidUntilInput']({ target: input } as unknown as Event);
      expect(fixture.componentInstance['form'].controls.validUntil.value).toContain('/');
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

  describe('submit() — success and error paths', () => {
    beforeEach(() => {
      fixture.componentInstance['form'].controls.name.setValue('Test Account');
    });

    it('emits saved with the server response on success', () => {
      const saved: AccountOverviewEntry[] = [];
      fixture.componentInstance.saved.subscribe((a) => saved.push(a));
      fixture.componentInstance['submit']();
      const response = makeAccount({ id: 'new-1', name: 'Test Account' });
      httpMock
        .expectOne('/api/account-overview/accounts')
        .flush(response, { status: 201, statusText: 'Created' });
      expect(saved).toHaveLength(1);
      expect(saved[0].id).toBe('new-1');
      expect(fixture.componentInstance['submitting']()).toBe(false);
    });

    it('shows generic error message on server failure', () => {
      fixture.componentInstance['submit']();
      httpMock
        .expectOne('/api/account-overview/accounts')
        .error(new ProgressEvent('error'), { status: 500 });
      expect(fixture.componentInstance['submitError']()).toBeTruthy();
      expect(fixture.componentInstance['submitting']()).toBe(false);
    });

    it('extracts field-level error messages from server response', () => {
      fixture.componentInstance['submit']();
      httpMock
        .expectOne('/api/account-overview/accounts')
        .flush(
          { fieldErrors: [{ field: 'name', message: 'Name already exists' }] },
          { status: 422, statusText: 'Unprocessable Entity' },
        );
      expect(fixture.componentInstance['submitError']()).toBe('Name already exists');
    });
  });
});
