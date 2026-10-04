import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import type { SessionUser } from '@vaultfolio/api-contract';
import { authInterceptor } from './auth.interceptor';
import { CurrentUserStore } from './current-user.store';
import { PAGE_LOADER } from './session-boundary';

describe('authInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let router: Router;
  const pageLoader = { assign: vi.fn(), reload: vi.fn() };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: PAGE_LOADER, useValue: pageLoader },
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

  it('loads /sign-in afresh on a 401 when a user was signed in on this page', () => {
    const store = TestBed.inject(CurrentUserStore);
    store.setAuthenticated({ id: 'u-1' } as SessionUser);
    http.get('/api/app/dashboard').subscribe({ error: () => undefined });

    httpMock
      .expectOne('/api/app/dashboard')
      .flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(store.current()).toBeNull();
    expect(pageLoader.assign).toHaveBeenCalledWith('/sign-in');
    expect(router.navigateByUrl).not.toHaveBeenCalled();
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
