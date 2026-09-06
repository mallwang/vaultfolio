import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { AccountOverviewEntry } from '@vaultfolio/api-contract';
import { AccountOverviewFormComponent } from './account-overview-form.component';

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
      provider: 'N26',
      website: 'https://n26.com',
      purpose: 'Everyday spending',
      cardUsage: 'Contactless only',
      requiredMinimum: '€500',
      notes: 'Shared with partner',
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
      provider: 'N26',
      website: 'https://n26.com',
      purpose: 'Everyday spending',
      cardUsage: 'Contactless only',
      requiredMinimum: '€500',
      notes: 'Shared with partner',
    });

    const response: AccountOverviewEntry = {
      id: 'a1',
      name: 'N26 checking',
      category: 'SAVINGS',
      provider: 'N26',
      website: 'https://n26.com',
      purpose: 'Everyday spending',
      cardUsage: 'Contactless only',
      requiredMinimum: '€500',
      notes: 'Shared with partner',
      createdAt: '2026-08-01T09:00:00.000Z',
      updatedAt: '2026-08-01T09:00:00.000Z',
    };
    req.flush(response, { status: 201, statusText: 'Created' });
  });

  it('submits an update request in edit mode', () => {
    const account: AccountOverviewEntry = {
      id: 'a1',
      name: 'N26 checking',
      category: 'GENERAL',
      provider: null,
      website: null,
      purpose: null,
      cardUsage: null,
      requiredMinimum: null,
      notes: null,
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
});
