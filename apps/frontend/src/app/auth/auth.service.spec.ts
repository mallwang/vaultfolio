import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { SessionUser } from '@vaultfolio/api-contract';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;

  const user: SessionUser = {
    id: 'user-1',
    email: 'user@example.com',
    displayName: 'User',
    role: 'MEMBER',
    domainScopes: [],
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('signIn() issues a POST to /api/auth/sign-in', () => {
    let result: SessionUser | undefined;
    service
      .signIn({ email: 'user@example.com', password: 'secret123' })
      .subscribe((res) => (result = res));

    const req = httpMock.expectOne('/api/auth/sign-in');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ email: 'user@example.com', password: 'secret123' });
    req.flush(user);

    expect(result).toEqual(user);
  });

  it('signIn() propagates an error', () => {
    let error: unknown;
    service.signIn({ email: 'user@example.com', password: 'wrong' }).subscribe({
      error: (err) => (error = err),
    });

    httpMock.expectOne('/api/auth/sign-in').error(new ProgressEvent('error'), { status: 401 });

    expect(error).toBeDefined();
  });

  it('signOut() issues a POST to /api/auth/sign-out', () => {
    let completed = false;
    service.signOut().subscribe(() => (completed = true));

    const req = httpMock.expectOne('/api/auth/sign-out');
    expect(req.request.method).toBe('POST');
    req.flush(null);

    expect(completed).toBe(true);
  });

  it('signOut() propagates an error', () => {
    let error: unknown;
    service.signOut().subscribe({ error: (err) => (error = err) });

    httpMock.expectOne('/api/auth/sign-out').error(new ProgressEvent('error'), { status: 500 });

    expect(error).toBeDefined();
  });

  it('getSession() issues a GET to /api/auth/session', () => {
    let result: SessionUser | undefined;
    service.getSession().subscribe((res) => (result = res));

    const req = httpMock.expectOne('/api/auth/session');
    expect(req.request.method).toBe('GET');
    req.flush(user);

    expect(result).toEqual(user);
  });

  it('getSession() propagates an error', () => {
    let error: unknown;
    service.getSession().subscribe({ error: (err) => (error = err) });

    httpMock.expectOne('/api/auth/session').error(new ProgressEvent('error'), { status: 401 });

    expect(error).toBeDefined();
  });
});
