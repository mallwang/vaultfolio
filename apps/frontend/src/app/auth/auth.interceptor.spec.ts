import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { authInterceptor } from './auth.interceptor';

describe('authInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
  });

  afterEach(() => httpMock.verify());

  it('redirects to /sign-in on a 401 from an arbitrary request', () => {
    http.get('/api/app/dashboard').subscribe({ error: () => undefined });

    httpMock
      .expectOne('/api/app/dashboard')
      .flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(router.navigateByUrl).toHaveBeenCalledWith('/sign-in');
  });

  it('does not redirect on a 401 from the sign-in call', () => {
    http.post('/api/auth/sign-in', {}).subscribe({ error: () => undefined });

    httpMock
      .expectOne('/api/auth/sign-in')
      .flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });

  it('does not redirect on a 401 from the bootstrap session probe', () => {
    // An anonymous visitor to a public page (e.g. /signup/verify/:token)
    // 401s here at bootstrap; this must not hijack navigation away from
    // the public route the router is about to activate.
    http.get('/api/auth/session').subscribe({ error: () => undefined });

    httpMock
      .expectOne('/api/auth/session')
      .flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });
});
