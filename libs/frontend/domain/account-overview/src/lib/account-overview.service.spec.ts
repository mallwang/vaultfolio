import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { AccountOverviewEntry } from '@vaultfolio/api-contract';
import { AccountOverviewService } from './account-overview.service';

describe('AccountOverviewService', () => {
  let service: AccountOverviewService;
  let httpMock: HttpTestingController;

  const entry: AccountOverviewEntry = {
    id: 'entry-1',
    name: 'Checking',
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
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AccountOverviewService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('list() issues a GET to /api/account-overview/accounts', () => {
    let result: AccountOverviewEntry[] | undefined;
    service.list().subscribe((res) => (result = res));

    const req = httpMock.expectOne('/api/account-overview/accounts');
    expect(req.request.method).toBe('GET');
    req.flush([entry]);

    expect(result).toEqual([entry]);
  });

  it('list() propagates an error', () => {
    let error: unknown;
    service.list().subscribe({ error: (err) => (error = err) });

    httpMock
      .expectOne('/api/account-overview/accounts')
      .error(new ProgressEvent('error'), { status: 500 });

    expect(error).toBeDefined();
  });

  it('create() issues a POST to /api/account-overview/accounts', () => {
    let result: AccountOverviewEntry | undefined;
    service.create({ name: 'Checking' }).subscribe((res) => (result = res));

    const req = httpMock.expectOne('/api/account-overview/accounts');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ name: 'Checking' });
    req.flush(entry);

    expect(result).toEqual(entry);
  });

  it('create() propagates an error', () => {
    let error: unknown;
    service.create({ name: 'Checking' }).subscribe({ error: (err) => (error = err) });

    httpMock
      .expectOne('/api/account-overview/accounts')
      .error(new ProgressEvent('error'), { status: 400 });

    expect(error).toBeDefined();
  });

  it('update() issues a PUT to /api/account-overview/accounts/:id', () => {
    let result: AccountOverviewEntry | undefined;
    service.update('entry-1', { name: 'Savings' }).subscribe((res) => (result = res));

    const req = httpMock.expectOne('/api/account-overview/accounts/entry-1');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ name: 'Savings' });
    req.flush({ ...entry, name: 'Savings' });

    expect(result?.name).toBe('Savings');
  });

  it('update() propagates an error', () => {
    let error: unknown;
    service.update('entry-1', { name: 'Savings' }).subscribe({ error: (err) => (error = err) });

    httpMock
      .expectOne('/api/account-overview/accounts/entry-1')
      .error(new ProgressEvent('error'), { status: 404 });

    expect(error).toBeDefined();
  });

  it('remove() issues a DELETE to /api/account-overview/accounts/:id', () => {
    let completed = false;
    service.remove('entry-1').subscribe(() => (completed = true));

    const req = httpMock.expectOne('/api/account-overview/accounts/entry-1');
    expect(req.request.method).toBe('DELETE');
    req.flush(null);

    expect(completed).toBe(true);
  });

  it('remove() propagates an error', () => {
    let error: unknown;
    service.remove('entry-1').subscribe({ error: (err) => (error = err) });

    httpMock
      .expectOne('/api/account-overview/accounts/entry-1')
      .error(new ProgressEvent('error'), { status: 404 });

    expect(error).toBeDefined();
  });
});
