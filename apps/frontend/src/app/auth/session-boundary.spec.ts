import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import type { SessionUser } from '@vaultfolio/api-contract';
import { CurrentUserStore } from './current-user.store';
import { PAGE_LOADER, SessionBoundary } from './session-boundary';

const admin = { id: 'admin-1' } as SessionUser;
const member = { id: 'member-1' } as SessionUser;

describe('SessionBoundary', () => {
  const pageLoader = { assign: vi.fn(), reload: vi.fn() };
  let boundary: SessionBoundary;
  let store: CurrentUserStore;
  let httpMock: HttpTestingController;
  let navigate: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    pageLoader.assign.mockReset();
    pageLoader.reload.mockReset();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: PAGE_LOADER, useValue: pageLoader },
      ],
    });
    boundary = TestBed.inject(SessionBoundary);
    store = TestBed.inject(CurrentUserStore);
    httpMock = TestBed.inject(HttpTestingController);
    navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
  });

  afterEach(() => httpMock.verify());

  it('enters in-app when no user was loaded on this page', () => {
    store.setUnauthenticated();
    boundary.enter(member, '/app/dashboard');

    expect(store.current()).toBe(member);
    expect(navigate).toHaveBeenCalledWith('/app/dashboard');
    expect(pageLoader.assign).not.toHaveBeenCalled();
  });

  it('loads the page afresh when a different user was loaded on this page', () => {
    store.setAuthenticated(admin);
    boundary.enter(member, '/app/dashboard');

    expect(pageLoader.assign).toHaveBeenCalledWith('/app/dashboard');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('always leaves with a full page load', () => {
    store.setAuthenticated(admin);
    boundary.leave();

    expect(boundary.leaving()).toBe(true);
    expect(store.status()).toBe('authenticated');
    expect(pageLoader.assign).toHaveBeenCalledWith('/sign-in');
  });

  describe('watch()', () => {
    const activate = () => window.dispatchEvent(new Event('focus'));

    beforeEach(() => boundary.watch());

    it('does not probe while nobody is signed in', () => {
      store.setUnauthenticated();
      activate();
      httpMock.expectNone('/api/auth/session');
      expect(pageLoader.reload).not.toHaveBeenCalled();
    });

    it('keeps the page when the session still belongs to the shown user', () => {
      store.setAuthenticated(admin);
      activate();
      httpMock.expectOne('/api/auth/session').flush(admin);

      expect(pageLoader.reload).not.toHaveBeenCalled();
    });

    it('reloads when another tab signed a different user in', () => {
      store.setAuthenticated(admin);
      activate();
      httpMock.expectOne('/api/auth/session').flush(member);

      expect(pageLoader.reload).toHaveBeenCalled();
    });

    it('leaves when the session is gone', () => {
      store.setAuthenticated(admin);
      activate();
      httpMock.expectOne('/api/auth/session').flush(null, { status: 401, statusText: 'x' });

      expect(pageLoader.assign).toHaveBeenCalledWith('/sign-in');
    });

    it('ignores a failed probe that is not a 401', () => {
      store.setAuthenticated(admin);
      activate();
      httpMock.expectOne('/api/auth/session').flush(null, { status: 503, statusText: 'x' });

      expect(pageLoader.assign).not.toHaveBeenCalled();
      expect(store.current()).toBe(admin);
    });
  });
});
