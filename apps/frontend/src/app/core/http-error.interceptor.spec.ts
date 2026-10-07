import { TestBed } from '@angular/core/testing';
import {
  HttpClient,
  HttpErrorResponse,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { buildFallbackDetail, httpErrorInterceptor } from './http-error.interceptor';
import { DomainMaintenanceStore } from './maintenance/domain-maintenance.store';

describe('httpErrorInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([httpErrorInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('propagates the error unchanged to the caller (never swallows it)', () => {
    let received: unknown;
    http.get('/api/accounts').subscribe({ error: (err) => (received = err) });

    httpMock
      .expectOne('/api/accounts')
      .flush(
        { error: 'unauthenticated', message: 'Sign in required.', correlationId: 'corr-1' },
        { status: 401, statusText: 'Unauthorized' },
      );

    expect(received).toMatchObject({ status: 401 });
  });

  it('does not alter a successful response', () => {
    let received: unknown;
    http.get('/api/accounts').subscribe({ next: (body) => (received = body) });

    httpMock.expectOne('/api/accounts').flush({ ok: true });

    expect(received).toEqual({ ok: true });
  });

  it('refreshes the maintenance store on a 503 DOMAIN_MAINTENANCE response', () => {
    const refresh = vi
      .spyOn(TestBed.inject(DomainMaintenanceStore), 'refresh')
      .mockImplementation(() => undefined);
    let received: unknown;
    http.get('/api/insurances').subscribe({ error: (err) => (received = err) });

    httpMock
      .expectOne('/api/insurances')
      .flush(
        { error: 'DOMAIN_MAINTENANCE', message: 'x', correlationId: 'corr-2' },
        { status: 503, statusText: 'Service Unavailable' },
      );

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(received).toMatchObject({ status: 503 });
  });

  it('does not refresh the maintenance store for other errors', () => {
    const refresh = vi
      .spyOn(TestBed.inject(DomainMaintenanceStore), 'refresh')
      .mockImplementation(() => undefined);
    http.get('/api/insurances').subscribe({ error: () => undefined });
    httpMock
      .expectOne('/api/insurances')
      .flush(
        { error: 'INSURANCES_UNAVAILABLE', message: 'x' },
        { status: 503, statusText: 'Service Unavailable' },
      );
    expect(refresh).not.toHaveBeenCalled();
  });
});

describe('buildFallbackDetail', () => {
  it('includes the correlationId when present on the error body', () => {
    const error = new HttpErrorResponse({
      error: { error: 'internal_server_error', message: 'oops', correlationId: 'corr-123' },
      status: 500,
    });
    expect(buildFallbackDetail(error)).toContain('corr-123');
  });

  it('falls back to a plain message when no correlationId is present', () => {
    const error = new HttpErrorResponse({ error: null, status: 0 });
    expect(buildFallbackDetail(error)).toBe('Please try again.');
  });
});
