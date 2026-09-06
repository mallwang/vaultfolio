import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { AccountOverviewEntry } from '@vaultfolio/api-contract';
import { AccountOverviewPageComponent } from './account-overview-page.component';

function makeAccount(overrides: Partial<AccountOverviewEntry>): AccountOverviewEntry {
  return {
    id: 'a1',
    name: 'N26 checking',
    category: 'OTHER',
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
    ...overrides,
  };
}

describe('AccountOverviewPageComponent', () => {
  let fixture: ComponentFixture<AccountOverviewPageComponent>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AccountOverviewPageComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(AccountOverviewPageComponent);
  });

  afterEach(() => {
    httpMock.verify();
  });

  function flushList(accounts: AccountOverviewEntry[]): void {
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    httpMock.expectOne('/api/account-overview/accounts').flush(accounts);
    fixture.detectChanges();
  }

  it('renders every account with its recorded fields (name, provider, purpose, detail chips)', () => {
    flushList([
      makeAccount({
        id: 'a1',
        name: 'N26 checking',
        provider: 'N26',
        website: 'https://n26.com',
        purpose: 'Everyday spending',
        cardUsage: 'Contactless only',
        requiredMinimum: '500',
        notes: 'Shared with partner',
      }),
    ]);

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('N26 checking');
    expect(text).toContain('N26');
    expect(text).toContain('Everyday spending');
    expect(text).toContain('Contactless only');
    expect(text).toContain('€500');
    expect(text).toContain('Shared with partner');
  });

  it('renders the website as a linked chip when recorded (FR-002)', () => {
    flushList([makeAccount({ provider: 'N26', website: 'https://n26.com' })]);

    const link = (fixture.nativeElement as HTMLElement).querySelector('a.chip--link');
    expect(link).not.toBeNull();
    expect(link?.getAttribute('href')).toBe('https://n26.com');
  });

  it('omits chips/purpose when their values are empty', () => {
    flushList([
      makeAccount({ purpose: null, cardUsage: null, requiredMinimum: null, notes: null }),
    ]);

    const chips = (fixture.nativeElement as HTMLElement).querySelectorAll('.chip');
    expect(chips).toHaveLength(0);
  });

  it('shows the derived brand badge and a masked card number with a reveal toggle for a credit card account', () => {
    flushList([
      makeAccount({
        id: 'a1',
        category: 'CREDIT_CARD',
        cardNumber: '4111 1111 1111 1111',
        validUntil: '09/28',
      }),
    ]);

    const nativeElement = fixture.nativeElement as HTMLElement;
    expect(
      nativeElement.querySelector('[data-testid="account-overview-row-a1-brand"]')?.textContent,
    ).toContain('VISA');

    const numberEl = nativeElement.querySelector(
      '[data-testid="account-overview-row-a1-card-number"]',
    );
    expect(numberEl?.textContent?.trim()).toBe('•••• •••• •••• 1111');
    expect(nativeElement.textContent).toContain('09/28');

    const revealButton = nativeElement.querySelector(
      '[data-testid="account-overview-row-a1-reveal"]',
    ) as HTMLElement;
    revealButton.click();
    fixture.detectChanges();

    expect(
      nativeElement
        .querySelector('[data-testid="account-overview-row-a1-card-number"]')
        ?.textContent?.trim(),
    ).toBe('4111 1111 1111 1111');
  });

  it('renders the empty state when there are no accounts', () => {
    flushList([]);

    const emptyState = (fixture.nativeElement as HTMLElement).querySelector(
      '[data-testid="account-overview-empty-state"]',
    );
    expect(emptyState).not.toBeNull();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('No accounts yet');
  });

  it('groups accounts by category in the fixed order, one group per in-use category, each with a count (FR-009, SC-005, US3)', () => {
    flushList([
      makeAccount({ id: 'a1', name: 'General acct', category: 'GENERAL' }),
      makeAccount({ id: 'a2', name: 'Leisure acct', category: 'LEISURE' }),
      makeAccount({ id: 'a3', name: 'Savings acct', category: 'SAVINGS' }),
      makeAccount({ id: 'a4', name: 'Card acct', category: 'CREDIT_CARD' }),
      makeAccount({ id: 'a5', name: 'Other acct', category: 'OTHER' }),
    ]);

    const headers = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('.account-group__header h3'),
    ).map((el) => el.textContent?.trim());
    expect(headers).toEqual(['General', 'Leisure', 'Savings', 'Credit Card', 'Other']);
  });

  it('sorts decommissioned accounts after active ones within a category, without dropping them', () => {
    flushList([
      makeAccount({
        id: 'a1',
        name: 'Closed depot',
        category: 'SAVINGS',
        status: 'DECOMMISSIONED',
      }),
      makeAccount({ id: 'a2', name: 'Open depot', category: 'SAVINGS', status: 'ACTIVE' }),
      makeAccount({ id: 'a3', name: 'Another open depot', category: 'SAVINGS', status: 'ACTIVE' }),
    ]);

    const rowIds = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('.account-row'),
    ).map((el) => (el as HTMLElement).getAttribute('data-testid'));
    expect(rowIds).toEqual([
      'account-overview-row-a2',
      'account-overview-row-a3',
      'account-overview-row-a1',
    ]);

    const statusBadge = (fixture.nativeElement as HTMLElement).querySelector(
      '[data-testid="account-overview-row-a1-status"]',
    );
    expect(statusBadge?.textContent?.trim()).toBe('Decommissioned');
  });

  it('omits empty category groups (Edge Cases)', () => {
    flushList([makeAccount({ id: 'a1', name: 'Savings only', category: 'SAVINGS' })]);

    const headers = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('.account-group__header h3'),
    ).map((el) => el.textContent?.trim());
    expect(headers).toEqual(['Savings']);
  });

  it('collapses to a single "All accounts" group with no per-category headers when every account is OTHER (Edge Cases, SC-004)', () => {
    flushList([
      makeAccount({ id: 'a1', name: 'First', category: 'OTHER' }),
      makeAccount({ id: 'a2', name: 'Second', category: 'OTHER' }),
    ]);

    const headers = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('.account-group__header h3'),
    ).map((el) => el.textContent?.trim());
    expect(headers).toEqual(['All accounts']);

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('First');
    expect(text).toContain('Second');
    // Both accounts remain editable/deletable — no lost functionality.
    expect(
      (fixture.nativeElement as HTMLElement).querySelector(
        '[data-testid="account-overview-row-a1-edit"]',
      ),
    ).not.toBeNull();
    expect(
      (fixture.nativeElement as HTMLElement).querySelector(
        '[data-testid="account-overview-row-a2-delete"]',
      ),
    ).not.toBeNull();
  });
});
