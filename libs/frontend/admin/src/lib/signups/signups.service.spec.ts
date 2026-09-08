import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { SignupSummary } from '@vaultfolio/api-contract';
import { SignupsAdminService } from './signups.service';

describe('SignupsAdminService', () => {
  let service: SignupsAdminService;
  let httpMock: HttpTestingController;

  const signup: SignupSummary = {
    id: 'signup-1',
    email: 'applicant@example.com',
    status: 'PENDING',
    createdAt: '2026-01-01T00:00:00.000Z',
    verifiedAt: null,
    resolvedAt: null,
    accountDeletedAt: null,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(SignupsAdminService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('list() issues a GET to /api/signups', () => {
    let result: SignupSummary[] | undefined;
    service.list().subscribe((res) => (result = res));

    const req = httpMock.expectOne('/api/signups');
    expect(req.request.method).toBe('GET');
    req.flush([signup]);

    expect(result).toEqual([signup]);
  });

  it('list() propagates an error', () => {
    let error: unknown;
    service.list().subscribe({ error: (err) => (error = err) });

    httpMock.expectOne('/api/signups').error(new ProgressEvent('error'), { status: 500 });

    expect(error).toBeDefined();
  });

  it('approve() issues a POST to /api/signups/:id/approve', () => {
    let result: SignupSummary | undefined;
    service.approve('signup-1').subscribe((res) => (result = res));

    const req = httpMock.expectOne('/api/signups/signup-1/approve');
    expect(req.request.method).toBe('POST');
    req.flush({ ...signup, status: 'APPROVED' });

    expect(result?.status).toBe('APPROVED');
  });

  it('approve() propagates an error', () => {
    let error: unknown;
    service.approve('signup-1').subscribe({ error: (err) => (error = err) });

    httpMock.expectOne('/api/signups/signup-1/approve').error(new ProgressEvent('error'), {
      status: 409,
    });

    expect(error).toBeDefined();
  });

  it('reject() issues a POST to /api/signups/:id/reject with an optional reason', () => {
    let result: SignupSummary | undefined;
    service.reject('signup-1', { reason: 'duplicate' }).subscribe((res) => (result = res));

    const req = httpMock.expectOne('/api/signups/signup-1/reject');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ reason: 'duplicate' });
    req.flush({ ...signup, status: 'REJECTED' });

    expect(result?.status).toBe('REJECTED');
  });

  it('reject() defaults the body to {} when no reason is given', () => {
    service.reject('signup-1').subscribe();

    const req = httpMock.expectOne('/api/signups/signup-1/reject');
    expect(req.request.body).toEqual({});
    req.flush({ ...signup, status: 'REJECTED' });
  });

  it('reject() propagates an error', () => {
    let error: unknown;
    service.reject('signup-1').subscribe({ error: (err) => (error = err) });

    httpMock.expectOne('/api/signups/signup-1/reject').error(new ProgressEvent('error'), {
      status: 409,
    });

    expect(error).toBeDefined();
  });

  it('delete() issues a DELETE to /api/signups/:id', () => {
    let result: { deleted: true } | undefined;
    service.delete('signup-1').subscribe((res) => (result = res));

    const req = httpMock.expectOne('/api/signups/signup-1');
    expect(req.request.method).toBe('DELETE');
    req.flush({ deleted: true });

    expect(result).toEqual({ deleted: true });
  });

  it('delete() propagates an error', () => {
    let error: unknown;
    service.delete('signup-1').subscribe({ error: (err) => (error = err) });

    httpMock.expectOne('/api/signups/signup-1').error(new ProgressEvent('error'), {
      status: 500,
    });

    expect(error).toBeDefined();
  });
});
