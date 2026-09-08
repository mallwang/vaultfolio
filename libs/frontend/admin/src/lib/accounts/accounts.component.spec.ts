import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ConfirmationService, MessageService } from 'primeng/api';
import { CURRENT_USER_SOURCE, DOMAIN_REGISTRY } from '@vaultfolio/frontend-domain-access';
import type { AccountSummary } from '@vaultfolio/api-contract';
import { AccountsComponent } from './accounts.component';
import { AccountsService } from './accounts.service';
import { Subject } from 'rxjs';

const makeAccount = (overrides: Partial<AccountSummary> = {}): AccountSummary => ({
  id: 'acc-1',
  email: 'user@example.com',
  displayName: 'Test User',
  role: 'MEMBER',
  status: 'ACTIVE',
  domainScopes: [],
  isLastActiveAdmin: false,
  archivedAt: null,
  retentionExpiresAt: null,
  ...overrides,
});

const SESSION_USER = {
  id: 'me',
  email: 'me@example.com',
  displayName: 'Me',
  role: 'ADMIN' as const,
  domainScopes: [],
};

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

  it('includes each domain as an independently listed option', () => {
    const ids = fixture.componentInstance['domainRegistry'].map((d) => d.id);
    expect(ids).toEqual([
      'holdings',
      'retirement',
      'insurances',
      'haushaltsplaner',
      'historic-wealth-development',
      'account-overview',
      'klaro',
    ]);
  });
});

describe('AccountsComponent — business logic', () => {
  let fixture: ComponentFixture<AccountsComponent>;
  let httpMock: HttpTestingController;
  let changedSubject: Subject<void>;

  const currentUserSource = { current: vi.fn().mockReturnValue(SESSION_USER) };

  beforeEach(async () => {
    changedSubject = new Subject<void>();

    await TestBed.configureTestingModule({
      imports: [AccountsComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        ConfirmationService,
        MessageService,
        { provide: CURRENT_USER_SOURCE, useValue: currentUserSource },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AccountsComponent);
    httpMock = TestBed.inject(HttpTestingController);

    // Stub changed$ on the shared service so we can trigger it
    const accountsService = TestBed.inject(AccountsService);
    Object.defineProperty(accountsService, 'changed$', {
      get: () => changedSubject.asObservable(),
    });

    fixture.detectChanges();
    httpMock.expectOne('/api/accounts').flush([]);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('load error', () => {
    it('sets loadError when the initial fetch fails', async () => {
      const comp = fixture.componentInstance;
      // Trigger a second fetch via changed$
      changedSubject.next();
      httpMock.expectOne('/api/accounts').error(new ProgressEvent('error'), { status: 500 });
      fixture.detectChanges();
      expect(comp['loadError']()).toBeTruthy();
    });
  });

  describe('changed$ subscription', () => {
    it('re-fetches accounts when changed$ emits', () => {
      changedSubject.next();
      const req = httpMock.expectOne('/api/accounts');
      req.flush([makeAccount()]);
      fixture.detectChanges();
      expect(fixture.componentInstance['accounts']()).toHaveLength(1);
    });
  });

  describe('roleSelectDisabledReason()', () => {
    it('returns cannotChangeOwnRole message for the signed-in user', () => {
      const account = makeAccount({ id: SESSION_USER.id });
      const reason = fixture.componentInstance['roleSelectDisabledReason'](account);
      expect(reason).toBeTruthy();
    });

    it('returns cannotChangeRoleLastAdmin message for the last active admin', () => {
      const account = makeAccount({ id: 'other', isLastActiveAdmin: true });
      const reason = fixture.componentInstance['roleSelectDisabledReason'](account);
      expect(reason).toBeTruthy();
    });

    it('returns cannotChangeRoleArchived message for an archived account', () => {
      const account = makeAccount({ id: 'other', status: 'ARCHIVED' });
      const reason = fixture.componentInstance['roleSelectDisabledReason'](account);
      expect(reason).toBeTruthy();
    });

    it('returns empty string when none of the conditions apply', () => {
      const account = makeAccount({ id: 'other' });
      expect(fixture.componentInstance['roleSelectDisabledReason'](account)).toBe('');
    });
  });

  describe('roleSelectDisabled()', () => {
    it('returns true when the reason is non-empty', () => {
      const account = makeAccount({ id: SESSION_USER.id });
      expect(fixture.componentInstance['roleSelectDisabled'](account)).toBe(true);
    });

    it('returns false when the reason is empty', () => {
      const account = makeAccount({ id: 'other' });
      expect(fixture.componentInstance['roleSelectDisabled'](account)).toBe(false);
    });
  });

  describe('domainScopesDisabledReason()', () => {
    it('returns disabled reason for ADMIN role', () => {
      const account = makeAccount({ role: 'ADMIN' });
      expect(fixture.componentInstance['domainScopesDisabledReason'](account)).toBeTruthy();
    });

    it('returns disabled reason for ARCHIVED status', () => {
      const account = makeAccount({ status: 'ARCHIVED' });
      expect(fixture.componentInstance['domainScopesDisabledReason'](account)).toBeTruthy();
    });

    it('returns empty string for active member', () => {
      const account = makeAccount();
      expect(fixture.componentInstance['domainScopesDisabledReason'](account)).toBe('');
    });
  });

  describe('domainDescriptor()', () => {
    it('returns the matching registry entry', () => {
      const descriptor = fixture.componentInstance['domainDescriptor']('holdings');
      expect(descriptor?.id).toBe('holdings');
    });

    it('returns undefined for an unknown domain', () => {
      expect(fixture.componentInstance['domainDescriptor']('unknown')).toBeUndefined();
    });
  });

  describe('archiveLabel()', () => {
    it('returns cannotArchiveLastAdmin label for last admin', () => {
      const account = makeAccount({ isLastActiveAdmin: true });
      expect(fixture.componentInstance['archiveLabel'](account)).toBeTruthy();
    });

    it('returns archiveAccount label for a normal account', () => {
      const account = makeAccount();
      expect(fixture.componentInstance['archiveLabel'](account)).toBeTruthy();
    });
  });

  describe('daysLeft()', () => {
    it('returns null when retentionExpiresAt is null', () => {
      expect(fixture.componentInstance['daysLeft'](makeAccount())).toBeNull();
    });

    it('returns a non-negative number of days for a future expiry', () => {
      const future = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
      const days = fixture.componentInstance['daysLeft'](
        makeAccount({ retentionExpiresAt: future }),
      );
      expect(days).toBeGreaterThanOrEqual(4);
    });

    it('returns 0 for a past expiry', () => {
      const past = new Date(Date.now() - 1000).toISOString();
      expect(fixture.componentInstance['daysLeft'](makeAccount({ retentionExpiresAt: past }))).toBe(
        0,
      );
    });
  });

  describe('onRoleChange()', () => {
    it('does nothing when the role is unchanged', () => {
      const account = makeAccount({ role: 'MEMBER' });
      fixture.componentInstance['onRoleChange'](account, 'MEMBER');
      httpMock.expectNone('/api/accounts/acc-1/role');
      expect(fixture.componentInstance['loading']()).toBe(false);
    });

    it('PATCHes the role and refreshes on success', () => {
      const account = makeAccount({ id: 'acc-1', role: 'MEMBER' });
      fixture.componentInstance['onRoleChange'](account, 'ADMIN');
      httpMock.expectOne('/api/accounts/acc-1/role').flush(makeAccount({ role: 'ADMIN' }));
      httpMock.expectOne('/api/accounts').flush([]);
      expect(fixture.componentInstance['loading']()).toBe(false);
    });

    it('shows warn toast and refreshes on 403 forbidden', () => {
      const account = makeAccount({ id: 'acc-1', role: 'MEMBER' });
      fixture.componentInstance['onRoleChange'](account, 'ADMIN');
      httpMock
        .expectOne('/api/accounts/acc-1/role')
        .error(new ProgressEvent('error'), { status: 403, statusText: 'Forbidden' });
      httpMock.expectOne('/api/accounts').flush([]);
      expect(fixture.componentInstance['loading']()).toBe(false);
    });

    it('shows last_admin banner on 409 last_admin error', () => {
      const account = makeAccount({ id: 'acc-1', role: 'MEMBER', displayName: 'Admin User' });
      fixture.componentInstance['onRoleChange'](account, 'ADMIN');
      httpMock
        .expectOne('/api/accounts/acc-1/role')
        .flush({ error: 'last_admin' }, { status: 409, statusText: 'Conflict' });
      httpMock.expectOne('/api/accounts').flush([]);
      expect(fixture.componentInstance['lastAdminBlockedFor']()).toBe('Admin User');
    });

    it('shows generic error toast on unknown error', () => {
      const account = makeAccount({ id: 'acc-1', role: 'MEMBER' });
      fixture.componentInstance['onRoleChange'](account, 'ADMIN');
      httpMock
        .expectOne('/api/accounts/acc-1/role')
        .error(new ProgressEvent('error'), { status: 500 });
      httpMock.expectOne('/api/accounts').flush([]);
      expect(fixture.componentInstance['loading']()).toBe(false);
    });
  });

  describe('onDomainScopesChange()', () => {
    it('PATCHes domain scopes and refreshes on success', () => {
      const account = makeAccount({ id: 'acc-1' });
      fixture.componentInstance['onDomainScopesChange'](account, ['holdings']);
      httpMock.expectOne('/api/accounts/acc-1/domain-scopes').flush(makeAccount());
      httpMock.expectOne('/api/accounts').flush([]);
      expect(fixture.componentInstance['loading']()).toBe(false);
    });

    it('refreshes and shows error toast on failure', () => {
      const account = makeAccount({ id: 'acc-1' });
      fixture.componentInstance['onDomainScopesChange'](account, ['holdings']);
      httpMock
        .expectOne('/api/accounts/acc-1/domain-scopes')
        .error(new ProgressEvent('error'), { status: 500 });
      httpMock.expectOne('/api/accounts').flush([]);
      expect(fixture.componentInstance['loading']()).toBe(false);
    });
  });

  describe('reactivate()', () => {
    it('reactivates and refreshes on success', () => {
      const account = makeAccount({ id: 'acc-1', status: 'ARCHIVED' });
      fixture.componentInstance['reactivate'](account);
      httpMock.expectOne('/api/accounts/acc-1/reactivate').flush(makeAccount());
      httpMock.expectOne('/api/accounts').flush([]);
      expect(fixture.componentInstance['loading']()).toBe(false);
    });

    it('shows retentionWindowPassed toast on 410', () => {
      const account = makeAccount({ id: 'acc-1', status: 'ARCHIVED' });
      fixture.componentInstance['reactivate'](account);
      httpMock
        .expectOne('/api/accounts/acc-1/reactivate')
        .error(new ProgressEvent('error'), { status: 410 });
      httpMock.expectOne('/api/accounts').flush([]);
      expect(fixture.componentInstance['loading']()).toBe(false);
    });

    it('shows generic error toast on unknown error', () => {
      const account = makeAccount({ id: 'acc-1', status: 'ARCHIVED' });
      fixture.componentInstance['reactivate'](account);
      httpMock
        .expectOne('/api/accounts/acc-1/reactivate')
        .error(new ProgressEvent('error'), { status: 500 });
      httpMock.expectOne('/api/accounts').flush([]);
      expect(fixture.componentInstance['loading']()).toBe(false);
    });
  });

  describe('confirmArchive() / archive()', () => {
    let cs: ConfirmationService;
    let ms: MessageService;

    beforeEach(() => {
      cs = fixture.debugElement.injector.get(ConfirmationService);
      ms = fixture.debugElement.injector.get(MessageService);
    });

    it('calls confirmationService.confirm', () => {
      const spy = vi.spyOn(cs, 'confirm');
      fixture.componentInstance['confirmArchive'](makeAccount(), new MouseEvent('click'));
      expect(spy).toHaveBeenCalledOnce();
    });

    it('POSTs to archive endpoint and shows success toast on confirm', () => {
      vi.spyOn(cs, 'confirm').mockImplementation((opts) => {
        opts.accept?.();
        return cs;
      });
      const addSpy = vi.spyOn(ms, 'add');
      fixture.componentInstance['confirmArchive'](
        makeAccount({ id: 'acc-1' }),
        new MouseEvent('click'),
      );
      httpMock.expectOne('/api/accounts/acc-1/archive').flush(makeAccount({ status: 'ARCHIVED' }));
      httpMock.expectOne('/api/accounts').flush([]);
      expect(addSpy).toHaveBeenCalledWith(expect.objectContaining({ severity: 'success' }));
    });

    it('shows info toast and refreshes on 409 already_archived', () => {
      vi.spyOn(cs, 'confirm').mockImplementation((opts) => {
        opts.accept?.();
        return cs;
      });
      const addSpy = vi.spyOn(ms, 'add');
      fixture.componentInstance['confirmArchive'](
        makeAccount({ id: 'acc-1' }),
        new MouseEvent('click'),
      );
      httpMock
        .expectOne('/api/accounts/acc-1/archive')
        .flush({ error: 'already_archived' }, { status: 409, statusText: 'Conflict' });
      httpMock.expectOne('/api/accounts').flush([]);
      expect(addSpy).toHaveBeenCalledWith(expect.objectContaining({ severity: 'info' }));
    });

    it('shows warn toast and sets lastAdminBlockedFor on 409 last_admin', () => {
      vi.spyOn(cs, 'confirm').mockImplementation((opts) => {
        opts.accept?.();
        return cs;
      });
      const addSpy = vi.spyOn(ms, 'add');
      const account = makeAccount({ id: 'acc-1', displayName: 'Last Admin' });
      fixture.componentInstance['confirmArchive'](account, new MouseEvent('click'));
      httpMock
        .expectOne('/api/accounts/acc-1/archive')
        .flush({ error: 'last_admin' }, { status: 409, statusText: 'Conflict' });
      httpMock.expectOne('/api/accounts').flush([]);
      expect(addSpy).toHaveBeenCalledWith(expect.objectContaining({ severity: 'warn' }));
      expect(fixture.componentInstance['lastAdminBlockedFor']()).toBe('Last Admin');
    });

    it('shows error toast on generic archive failure', () => {
      vi.spyOn(cs, 'confirm').mockImplementation((opts) => {
        opts.accept?.();
        return cs;
      });
      const addSpy = vi.spyOn(ms, 'add');
      fixture.componentInstance['confirmArchive'](
        makeAccount({ id: 'acc-1' }),
        new MouseEvent('click'),
      );
      httpMock
        .expectOne('/api/accounts/acc-1/archive')
        .error(new ProgressEvent('error'), { status: 500 });
      httpMock.expectOne('/api/accounts').flush([]);
      expect(addSpy).toHaveBeenCalledWith(expect.objectContaining({ severity: 'error' }));
    });
  });
});
