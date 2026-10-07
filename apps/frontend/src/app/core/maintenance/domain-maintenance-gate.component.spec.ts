import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import type { SessionUser } from '@vaultfolio/api-contract';
import { CurrentUserStore } from '../../auth/current-user.store';
import { FakeCurrentUserStore } from '../../auth/testing/current-user-store.testing';
import { DomainMaintenanceGateComponent } from './domain-maintenance-gate.component';

@Component({ selector: 'app-dummy-page', template: '<p data-testid="page">domain page</p>' })
class DummyPageComponent {}

const member: SessionUser = {
  id: 'm1',
  email: 'm@example.com',
  displayName: 'Member',
  role: 'MEMBER',
  domainScopes: ['insurances'],
};
const admin: SessionUser = { ...member, id: 'a1', role: 'ADMIN', domainScopes: [] };

describe('DomainMaintenanceGateComponent', () => {
  let fixture: ComponentFixture<DomainMaintenanceGateComponent>;
  let currentUser: FakeCurrentUserStore;
  let http: HttpTestingController;
  let router: Router;

  const el = (testId: string): HTMLElement | null =>
    (fixture.nativeElement as HTMLElement).querySelector(`[data-testid="${testId}"]`);

  async function open(user: SessionUser, url: string, inMaintenance: string[]) {
    currentUser.setAuthenticated(user);
    fixture = TestBed.createComponent(DomainMaintenanceGateComponent);
    fixture.detectChanges();
    http.expectOne('/api/domains/maintenance').flush({ domains: inMaintenance });
    await router.navigateByUrl(url);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(() => {
    localStorage.clear();
    currentUser = new FakeCurrentUserStore();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'app/insurances', component: DummyPageComponent },
          { path: 'app/holdings', component: DummyPageComponent },
          { path: 'app/dashboard', component: DummyPageComponent },
        ]),
        { provide: CurrentUserStore, useValue: currentUser },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
  });

  afterEach(() => {
    fixture?.destroy();
    http.verify();
  });

  it('renders nothing until the maintenance list has loaded', async () => {
    currentUser.setAuthenticated(member);
    fixture = TestBed.createComponent(DomainMaintenanceGateComponent);
    await router.navigateByUrl('/app/insurances');
    fixture.detectChanges();
    expect(el('page')).toBeNull();
    expect(el('maintenance-notice')).toBeNull();
    http.expectOne('/api/domains/maintenance').flush({ domains: [] });
  });

  it('shows the orange notice instead of the page for an entitled member', async () => {
    await open(member, '/app/insurances', ['insurances']);
    expect(el('maintenance-notice')).not.toBeNull();
    expect(el('page')).toBeNull();
  });

  it('renders the page normally while the domain is active', async () => {
    await open(member, '/app/insurances', []);
    expect(el('page')).not.toBeNull();
    expect(el('maintenance-notice')).toBeNull();
    expect(el('maintenance-banner')).toBeNull();
  });

  it('leaves other domains and non-domain pages untouched', async () => {
    await open(member, '/app/dashboard', ['insurances']);
    expect(el('page')).not.toBeNull();
    expect(el('maintenance-notice')).toBeNull();
  });

  it('keeps the page and adds a banner for an admin', async () => {
    await open(admin, '/app/insurances', ['insurances']);
    expect(el('page')).not.toBeNull();
    expect(el('maintenance-banner')).not.toBeNull();
    expect(el('maintenance-notice')).toBeNull();
  });

  it('does not show the notice to a member who is not entitled to the domain', async () => {
    await open({ ...member, domainScopes: ['holdings'] }, '/app/insurances', ['insurances']);
    expect(el('maintenance-notice')).toBeNull();
  });

  it('switches between the page and the notice when navigating', async () => {
    await open(member, '/app/holdings', ['insurances']);
    expect(el('page')).not.toBeNull();
    await router.navigateByUrl('/app/insurances');
    fixture.detectChanges();
    expect(el('maintenance-notice')).not.toBeNull();
    await router.navigateByUrl('/app/holdings');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(el('page')).not.toBeNull();
  });
});
