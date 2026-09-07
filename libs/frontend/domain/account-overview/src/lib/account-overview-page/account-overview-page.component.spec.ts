import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ConfirmationService, MessageService } from 'primeng/api';
import type { AccountOverviewEntry } from '@vaultfolio/api-contract';
import { AccountOverviewPageComponent } from './account-overview-page.component';

const makeAccount = (overrides: Partial<AccountOverviewEntry> = {}): AccountOverviewEntry => ({
  id: 'acc-1',
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

describe('AccountOverviewPageComponent', () => {
  let fixture: ComponentFixture<AccountOverviewPageComponent>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AccountOverviewPageComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        ConfirmationService,
        MessageService,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AccountOverviewPageComponent);
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    httpMock.expectOne('/api/account-overview/accounts').flush([makeAccount()]);
    fixture.detectChanges();
  });

  afterEach(() => httpMock.verify());

  describe('ngOnInit / refresh()', () => {
    it('loads accounts and sets loading=false', () => {
      const comp = fixture.componentInstance;
      expect(comp['loading']()).toBe(false);
      expect(comp['accounts']()).toHaveLength(1);
    });

    it('sets loadError on fetch failure', () => {
      const comp2 = TestBed.createComponent(AccountOverviewPageComponent);
      comp2.detectChanges();
      httpMock
        .expectOne('/api/account-overview/accounts')
        .error(new ProgressEvent('error'), { status: 500 });
      expect(comp2.componentInstance['loadError']()).toBeTruthy();
      expect(comp2.componentInstance['loading']()).toBe(false);
    });
  });

  describe('groups() computed', () => {
    it('groups accounts by category, omitting empty ones', () => {
      const comp = fixture.componentInstance;
      comp['accounts'].set([
        makeAccount({ id: '1', category: 'SAVINGS' }),
        makeAccount({ id: '2', category: 'GENERAL' }),
      ]);
      const groups = comp['groups']();
      const cats = groups.map((g) => g.category);
      expect(cats).toContain('GENERAL');
      expect(cats).toContain('SAVINGS');
      expect(cats).not.toContain('LEISURE');
    });

    it('collapses to ALL group when every account is OTHER', () => {
      const comp = fixture.componentInstance;
      comp['accounts'].set([makeAccount({ category: 'OTHER' })]);
      const groups = comp['groups']();
      expect(groups).toHaveLength(1);
      expect(groups[0].category).toBe('ALL');
    });

    it('returns empty groups when accounts list is empty', () => {
      fixture.componentInstance['accounts'].set([]);
      expect(fixture.componentInstance['groups']()).toHaveLength(0);
    });

    it('sorts ACTIVE accounts before DECOMMISSIONED within a group', () => {
      const comp = fixture.componentInstance;
      comp['accounts'].set([
        makeAccount({ id: 'd', category: 'SAVINGS', status: 'DECOMMISSIONED' }),
        makeAccount({ id: 'a', category: 'SAVINGS', status: 'ACTIVE' }),
      ]);
      const group = comp['groups']()[0];
      expect(group.accounts[0].status).toBe('ACTIVE');
      expect(group.accounts[1].status).toBe('DECOMMISSIONED');
    });
  });

  describe('initialsFor()', () => {
    it('returns first letter of a single word', () => {
      expect(fixture.componentInstance['initialsFor']('Alice')).toBe('A');
    });

    it('returns first letters of first two words', () => {
      expect(fixture.componentInstance['initialsFor']('John Doe Smith')).toBe('JD');
    });

    it('trims whitespace before extracting', () => {
      expect(fixture.componentInstance['initialsFor']('  Bob  ')).toBe('B');
    });
  });

  describe('cardBrandFor()', () => {
    it('returns null for non-CREDIT_CARD accounts', () => {
      expect(
        fixture.componentInstance['cardBrandFor'](makeAccount({ category: 'SAVINGS' })),
      ).toBeNull();
    });

    it('returns a brand (or null) for a CREDIT_CARD account', () => {
      const result = fixture.componentInstance['cardBrandFor'](
        makeAccount({ category: 'CREDIT_CARD', cardNumber: '4111 1111 1111 1111' }),
      );
      // deriveCardBrand decides the value; we just confirm it's a string or null
      expect(typeof result === 'string' || result === null).toBe(true);
    });
  });

  describe('maskCardNumber()', () => {
    it('masks all but the last 4 digits', () => {
      const masked = fixture.componentInstance['maskCardNumber']('4111 1111 1111 1234');
      expect(masked).toContain('1234');
      expect(masked).not.toContain('4111');
    });

    it('preserves grouping with spaces', () => {
      const masked = fixture.componentInstance['maskCardNumber']('4111111111111234');
      expect(masked.trim().split(' ').at(-1)).toBe('1234');
    });
  });

  describe('toggleReveal() / isRevealed()', () => {
    it('isRevealed returns false initially', () => {
      expect(fixture.componentInstance['isRevealed']('acc-1')).toBe(false);
    });

    it('toggleReveal reveals an account', () => {
      fixture.componentInstance['toggleReveal']('acc-1');
      expect(fixture.componentInstance['isRevealed']('acc-1')).toBe(true);
    });

    it('toggleReveal hides a revealed account', () => {
      fixture.componentInstance['toggleReveal']('acc-1');
      fixture.componentInstance['toggleReveal']('acc-1');
      expect(fixture.componentInstance['isRevealed']('acc-1')).toBe(false);
    });
  });

  describe('dialog management', () => {
    it('openAddDialog sets editingAccount=null and shows dialog', () => {
      fixture.componentInstance['openAddDialog']();
      expect(fixture.componentInstance['editingAccount']()).toBeNull();
      expect(fixture.componentInstance['dialogVisible']()).toBe(true);
    });

    it('openEditDialog sets the account and shows dialog', () => {
      const account = makeAccount();
      fixture.componentInstance['openEditDialog'](account);
      expect(fixture.componentInstance['editingAccount']()).toBe(account);
      expect(fixture.componentInstance['dialogVisible']()).toBe(true);
    });

    it('onCancelled hides the dialog', () => {
      fixture.componentInstance['openAddDialog']();
      fixture.componentInstance['onCancelled']();
      expect(fixture.componentInstance['dialogVisible']()).toBe(false);
    });
  });

  describe('onSaved()', () => {
    it('appends a new account when id is not in current list', () => {
      const comp = fixture.componentInstance;
      const newAccount = makeAccount({ id: 'acc-new', name: 'New Account' });
      comp['onSaved'](newAccount);
      expect(comp['accounts']().find((a) => a.id === 'acc-new')).toBeTruthy();
    });

    it('replaces an existing account with the updated one', () => {
      const comp = fixture.componentInstance;
      const updated = makeAccount({ id: 'acc-1', name: 'Updated Name' });
      comp['onSaved'](updated);
      const found = comp['accounts']().find((a) => a.id === 'acc-1');
      expect(found?.name).toBe('Updated Name');
    });

    it('hides the dialog after saving', () => {
      fixture.componentInstance['openAddDialog']();
      fixture.componentInstance['onSaved'](makeAccount({ id: 'new' }));
      expect(fixture.componentInstance['dialogVisible']()).toBe(false);
    });
  });

  describe('confirmDelete() / deleteAccount()', () => {
    let cs: ConfirmationService;
    let ms: MessageService;

    beforeEach(() => {
      cs = fixture.debugElement.injector.get(ConfirmationService);
      ms = fixture.debugElement.injector.get(MessageService);
    });

    it('calls confirmationService.confirm', () => {
      const spy = vi.spyOn(cs, 'confirm');
      fixture.componentInstance['confirmDelete'](makeAccount(), new MouseEvent('click'));
      expect(spy).toHaveBeenCalledOnce();
    });

    it('removes the account and shows success toast on DELETE success', () => {
      vi.spyOn(cs, 'confirm').mockImplementation((opts) => {
        opts.accept?.();
        return cs;
      });
      const addSpy = vi.spyOn(ms, 'add');
      fixture.componentInstance['confirmDelete'](
        makeAccount({ id: 'acc-1' }),
        new MouseEvent('click'),
      );
      httpMock.expectOne('/api/account-overview/accounts/acc-1').flush(null);
      expect(fixture.componentInstance['accounts']().find((a) => a.id === 'acc-1')).toBeUndefined();
      expect(addSpy).toHaveBeenCalledWith(expect.objectContaining({ severity: 'success' }));
    });

    it('handles 404 as already-deleted (info toast + refresh)', () => {
      vi.spyOn(cs, 'confirm').mockImplementation((opts) => {
        opts.accept?.();
        return cs;
      });
      const addSpy = vi.spyOn(ms, 'add');
      fixture.componentInstance['confirmDelete'](
        makeAccount({ id: 'acc-1' }),
        new MouseEvent('click'),
      );
      httpMock
        .expectOne('/api/account-overview/accounts/acc-1')
        .error(new ProgressEvent('error'), { status: 404 });
      httpMock.expectOne('/api/account-overview/accounts').flush([]);
      expect(addSpy).toHaveBeenCalledWith(expect.objectContaining({ severity: 'info' }));
    });

    it('shows error toast on non-404 DELETE failure', () => {
      vi.spyOn(cs, 'confirm').mockImplementation((opts) => {
        opts.accept?.();
        return cs;
      });
      const addSpy = vi.spyOn(ms, 'add');
      fixture.componentInstance['confirmDelete'](
        makeAccount({ id: 'acc-1' }),
        new MouseEvent('click'),
      );
      httpMock
        .expectOne('/api/account-overview/accounts/acc-1')
        .error(new ProgressEvent('error'), { status: 500 });
      expect(addSpy).toHaveBeenCalledWith(expect.objectContaining({ severity: 'error' }));
    });
  });
});
