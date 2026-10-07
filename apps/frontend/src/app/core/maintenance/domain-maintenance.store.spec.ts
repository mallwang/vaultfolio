import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { SessionUser } from '@vaultfolio/api-contract';
import { CurrentUserStore } from '../../auth/current-user.store';
import { FakeCurrentUserStore } from '../../auth/testing/current-user-store.testing';
import { DomainMaintenanceStore } from './domain-maintenance.store';

const user = (id: string): SessionUser => ({
  id,
  email: `${id}@example.com`,
  displayName: id,
  role: 'MEMBER',
  domainScopes: [],
});

describe('DomainMaintenanceStore', () => {
  let store: DomainMaintenanceStore;
  let currentUser: FakeCurrentUserStore;
  let http: HttpTestingController;

  beforeEach(() => {
    currentUser = new FakeCurrentUserStore();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: CurrentUserStore, useValue: currentUser },
      ],
    });
    store = TestBed.inject(DomainMaintenanceStore);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('starts empty and not loaded', () => {
    expect(store.loaded()).toBe(false);
    expect(store.isInMaintenance('insurances')).toBe(false);
  });

  it('does not load for an anonymous visitor', () => {
    store.ensureLoaded();
    http.expectNone('/api/domains/maintenance');
    expect(store.loaded()).toBe(false);
  });

  it('loads once per signed-in user', () => {
    currentUser.setAuthenticated(user('u1'));
    store.ensureLoaded();
    http.expectOne('/api/domains/maintenance').flush({ domains: ['insurances'] });
    expect(store.loaded()).toBe(true);
    expect(store.isInMaintenance('insurances')).toBe(true);
    expect(store.isInMaintenance('holdings')).toBe(false);

    store.ensureLoaded();
    http.expectNone('/api/domains/maintenance');

    currentUser.setAuthenticated(user('u2'));
    store.ensureLoaded();
    http.expectOne('/api/domains/maintenance').flush({ domains: [] });
    expect(store.isInMaintenance('insurances')).toBe(false);
  });

  it('refresh() reloads the list', () => {
    currentUser.setAuthenticated(user('u1'));
    store.refresh();
    http.expectOne('/api/domains/maintenance').flush({ domains: [] });
    store.refresh();
    http.expectOne('/api/domains/maintenance').flush({ domains: ['holdings'] });
    expect(store.isInMaintenance('holdings')).toBe(true);
  });

  it('treats a failed load as "nothing in maintenance" and still reports loaded', () => {
    currentUser.setAuthenticated(user('u1'));
    store.ensureLoaded();
    http
      .expectOne('/api/domains/maintenance')
      .flush({}, { status: 500, statusText: 'Server Error' });
    expect(store.loaded()).toBe(true);
    expect(store.isInMaintenance('insurances')).toBe(false);
  });
});
