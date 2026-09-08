import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { AccountSummary } from '@vaultfolio/api-contract';
import { AccountsService } from './accounts.service';

describe('AccountsService', () => {
  let service: AccountsService;
  let httpMock: HttpTestingController;

  const account: AccountSummary = {
    id: 'acc-1',
    email: 'user@example.com',
    displayName: 'User',
    role: 'MEMBER',
    status: 'ACTIVE',
    archivedAt: null,
    retentionExpiresAt: null,
    isLastActiveAdmin: false,
    domainScopes: [],
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AccountsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('list() issues a GET to /api/accounts', () => {
    let result: AccountSummary[] | undefined;
    service.list().subscribe((res) => (result = res));

    const req = httpMock.expectOne('/api/accounts');
    expect(req.request.method).toBe('GET');
    req.flush([account]);

    expect(result).toEqual([account]);
  });

  it('list() propagates an error', () => {
    let error: unknown;
    service.list().subscribe({ error: (err) => (error = err) });

    httpMock.expectOne('/api/accounts').error(new ProgressEvent('error'), { status: 500 });

    expect(error).toBeDefined();
  });

  it('changeRole() issues a PATCH to /api/accounts/:id/role', () => {
    let result: AccountSummary | undefined;
    service.changeRole('acc-1', { role: 'ADMIN' }).subscribe((res) => (result = res));

    const req = httpMock.expectOne('/api/accounts/acc-1/role');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ role: 'ADMIN' });
    req.flush({ ...account, role: 'ADMIN' });

    expect(result?.role).toBe('ADMIN');
  });

  it('changeRole() propagates an error', () => {
    let error: unknown;
    service.changeRole('acc-1', { role: 'ADMIN' }).subscribe({ error: (err) => (error = err) });

    httpMock.expectOne('/api/accounts/acc-1/role').error(new ProgressEvent('error'), {
      status: 409,
    });

    expect(error).toBeDefined();
  });

  it('updateDomainScopes() issues a PATCH to /api/accounts/:id/domain-scopes', () => {
    let result: AccountSummary | undefined;
    service
      .updateDomainScopes('acc-1', { domainScopes: ['finance'] })
      .subscribe((res) => (result = res));

    const req = httpMock.expectOne('/api/accounts/acc-1/domain-scopes');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ domainScopes: ['finance'] });
    req.flush({ ...account, domainScopes: ['finance'] });

    expect(result?.domainScopes).toEqual(['finance']);
  });

  it('updateDomainScopes() propagates an error', () => {
    let error: unknown;
    service.updateDomainScopes('acc-1', { domainScopes: ['finance'] }).subscribe({
      error: (err) => (error = err),
    });

    httpMock
      .expectOne('/api/accounts/acc-1/domain-scopes')
      .error(new ProgressEvent('error'), { status: 400 });

    expect(error).toBeDefined();
  });

  it('archive() issues a POST to /api/accounts/:id/archive', () => {
    let result: AccountSummary | undefined;
    service.archive('acc-1').subscribe((res) => (result = res));

    const req = httpMock.expectOne('/api/accounts/acc-1/archive');
    expect(req.request.method).toBe('POST');
    req.flush({ ...account, status: 'ARCHIVED' });

    expect(result?.status).toBe('ARCHIVED');
  });

  it('archive() propagates an error', () => {
    let error: unknown;
    service.archive('acc-1').subscribe({ error: (err) => (error = err) });

    httpMock.expectOne('/api/accounts/acc-1/archive').error(new ProgressEvent('error'), {
      status: 409,
    });

    expect(error).toBeDefined();
  });

  it('reactivate() issues a POST to /api/accounts/:id/reactivate', () => {
    let result: AccountSummary | undefined;
    service.reactivate('acc-1').subscribe((res) => (result = res));

    const req = httpMock.expectOne('/api/accounts/acc-1/reactivate');
    expect(req.request.method).toBe('POST');
    req.flush({ ...account, status: 'ACTIVE' });

    expect(result?.status).toBe('ACTIVE');
  });

  it('reactivate() propagates an error', () => {
    let error: unknown;
    service.reactivate('acc-1').subscribe({ error: (err) => (error = err) });

    httpMock.expectOne('/api/accounts/acc-1/reactivate').error(new ProgressEvent('error'), {
      status: 409,
    });

    expect(error).toBeDefined();
  });

  it('deleteSelf() issues a DELETE to /api/accounts/:id', () => {
    let completed = false;
    service.deleteSelf('acc-1').subscribe(() => (completed = true));

    const req = httpMock.expectOne('/api/accounts/acc-1');
    expect(req.request.method).toBe('DELETE');
    req.flush(null);

    expect(completed).toBe(true);
  });

  it('deleteSelf() propagates an error', () => {
    let error: unknown;
    service.deleteSelf('acc-1').subscribe({ error: (err) => (error = err) });

    httpMock.expectOne('/api/accounts/acc-1').error(new ProgressEvent('error'), { status: 500 });

    expect(error).toBeDefined();
  });

  it('notifyChanged() emits on changed$', () => {
    let emitted = false;
    service.changed$.subscribe(() => (emitted = true));

    service.notifyChanged();

    expect(emitted).toBe(true);
  });
});
