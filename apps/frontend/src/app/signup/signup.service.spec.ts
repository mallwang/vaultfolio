import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { SignupSubmitted } from '@vaultfolio/api-contract';
import { SignupService } from './signup.service';

describe('SignupService', () => {
  let service: SignupService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(SignupService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('submit() issues a POST to /api/signups', () => {
    let result: SignupSubmitted | undefined;
    service
      .submit({ email: 'user@example.com', password: 'secret123', turnstileToken: 'tk' })
      .subscribe((res) => (result = res));

    const req = httpMock.expectOne('/api/signups');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      email: 'user@example.com',
      password: 'secret123',
      turnstileToken: 'tk',
    });
    req.flush({ email: 'user@example.com' });

    expect(result).toEqual({ email: 'user@example.com' });
  });

  it('submit() propagates an error', () => {
    let error: unknown;
    service
      .submit({ email: 'user@example.com', password: 'secret123', turnstileToken: 'tk' })
      .subscribe({ error: (err) => (error = err) });

    httpMock.expectOne('/api/signups').error(new ProgressEvent('error'), { status: 409 });

    expect(error).toBeDefined();
  });

  it('lookupToken() issues a GET to /api/signups/token/:token', () => {
    let result: { email: string } | undefined;
    service.lookupToken('tok123').subscribe((res) => (result = res));

    const req = httpMock.expectOne('/api/signups/token/tok123');
    expect(req.request.method).toBe('GET');
    req.flush({ email: 'user@example.com' });

    expect(result).toEqual({ email: 'user@example.com' });
  });

  it('lookupToken() propagates an error', () => {
    let error: unknown;
    service.lookupToken('bad-token').subscribe({ error: (err) => (error = err) });

    httpMock
      .expectOne('/api/signups/token/bad-token')
      .error(new ProgressEvent('error'), { status: 410 });

    expect(error).toBeDefined();
  });

  it('verify() issues a POST to /api/signups/token/:token/verify', () => {
    let result: { email: string; status: 'VERIFIED' } | undefined;
    service.verify('tok123').subscribe((res) => (result = res));

    const req = httpMock.expectOne('/api/signups/token/tok123/verify');
    expect(req.request.method).toBe('POST');
    req.flush({ email: 'user@example.com', status: 'VERIFIED' });

    expect(result).toEqual({ email: 'user@example.com', status: 'VERIFIED' });
  });

  it('verify() propagates an error', () => {
    let error: unknown;
    service.verify('bad-token').subscribe({ error: (err) => (error = err) });

    httpMock
      .expectOne('/api/signups/token/bad-token/verify')
      .error(new ProgressEvent('error'), { status: 410 });

    expect(error).toBeDefined();
  });
});
