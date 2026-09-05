import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ConfirmationService, MessageService } from 'primeng/api';
import { CURRENT_USER_SOURCE, DOMAIN_REGISTRY } from '@vaultfolio/frontend-domain-access';
import { AccountsComponent } from './accounts.component';

/**
 * 022-add-domain-placeholders, US3 (contracts/registry-additions.md §1): the
 * domain-scope multiselect is driven entirely by `DOMAIN_REGISTRY` — the
 * five new placeholder domains appear as independently togglable options
 * with no admin-UI code change (data-model.md, T034).
 */
describe('AccountsComponent — domain-scope options', () => {
  let fixture: ComponentFixture<AccountsComponent>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AccountsComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        ConfirmationService,
        MessageService,
        { provide: CURRENT_USER_SOURCE, useValue: { current: () => null } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AccountsComponent);
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    httpMock.expectOne('/api/accounts').flush([]);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('sources the domain-scope options directly from DOMAIN_REGISTRY', () => {
    expect(fixture.componentInstance['domainRegistry']).toBe(DOMAIN_REGISTRY);
  });

  it('includes each of the five new placeholder domains as an independently listed option', () => {
    const ids = fixture.componentInstance['domainRegistry'].map((d) => d.id);
    expect(ids).toEqual([
      'holdings',
      'retirement',
      'insurances',
      'haushaltsplaner',
      'historic-wealth-development',
      'account-overview',
    ]);
  });
});
