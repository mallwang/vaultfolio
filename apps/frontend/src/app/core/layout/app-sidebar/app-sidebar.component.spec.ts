import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { SessionUser } from '@vaultfolio/api-contract';
import { AppSidebarComponent } from './app-sidebar.component';
import { CurrentUserStore } from '../../../auth/current-user.store';
import { FakeCurrentUserStore } from '../../../auth/testing/current-user-store.testing';
import { DomainMaintenanceStore } from '../../maintenance/domain-maintenance.store';

const adminUser: SessionUser = {
  id: 'user-1',
  email: 'admin@example.com',
  displayName: 'Admin',
  role: 'ADMIN',
  domainScopes: [],
};

const memberUser: SessionUser = {
  id: 'user-2',
  email: 'member@example.com',
  displayName: 'Member',
  role: 'MEMBER',
  domainScopes: [],
};

// 028-klaro-nav-integration, US1: entitled to Klaro specifically (rather than
// ADMIN's blanket entitlement) to exercise the same domainId filter every
// other domain-gated area already uses.
const klaroUser: SessionUser = {
  id: 'user-3',
  email: 'klaro@example.com',
  displayName: 'Klaro User',
  role: 'MEMBER',
  domainScopes: ['klaro'],
};

describe('AppSidebarComponent', () => {
  let fakeCurrentUser: FakeCurrentUserStore;

  beforeEach(async () => {
    fakeCurrentUser = new FakeCurrentUserStore();
    await TestBed.configureTestingModule({
      imports: [AppSidebarComponent],
      providers: [provideRouter([]), { provide: CurrentUserStore, useValue: fakeCurrentUser }],
    }).compileComponents();
  });

  it('shows the Admin nav entry for an ADMIN user', async () => {
    fakeCurrentUser.setAuthenticated(adminUser);
    const fixture = TestBed.createComponent(AppSidebarComponent);
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Admin');
  });

  it('hides the Admin nav entry for a MEMBER user', async () => {
    fakeCurrentUser.setAuthenticated(memberUser);
    const fixture = TestBed.createComponent(AppSidebarComponent);
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).not.toContain('Admin');
  });

  // 028-klaro-nav-integration, US1: the Klaro entry renders with its logo
  // image (not app-icon) and sits between Account Overview and Settings.
  it('renders the Klaro entry with its logo image, positioned between Account Overview and Settings', async () => {
    fakeCurrentUser.setAuthenticated(klaroUser);
    const fixture = TestBed.createComponent(AppSidebarComponent);
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const klaroEntry = compiled.querySelector('[data-testid="sidebar-nav-item-klaro"]');
    expect(klaroEntry).toBeTruthy();
    expect(klaroEntry?.querySelector('img.app-nav__logo')).toBeTruthy();
    expect(klaroEntry?.querySelector('app-icon')).toBeFalsy();

    const items = Array.from(compiled.querySelectorAll('.app-nav__item'));
    const ids = items.map((item) => item.getAttribute('data-testid'));
    const accountOverviewIndex = ids.indexOf('sidebar-nav-item-account-overview');
    const klaroIndex = ids.indexOf('sidebar-nav-item-klaro');
    const settingsIndex = ids.indexOf('sidebar-nav-item-settings');
    expect(accountOverviewIndex).toBeLessThan(klaroIndex);
    expect(klaroIndex).toBeLessThan(settingsIndex);
  });

  // 032-earnings-domain (FR-001/FR-002): the Earnings entry shows only to entitled members.
  it('shows the Earnings entry only to a member entitled to earnings', async () => {
    fakeCurrentUser.setAuthenticated({ ...memberUser, domainScopes: ['earnings'] });
    const entitled = TestBed.createComponent(AppSidebarComponent);
    await entitled.whenStable();
    entitled.detectChanges();
    const entry = (entitled.nativeElement as HTMLElement).querySelector(
      '[data-testid="sidebar-nav-item-earnings"]',
    );
    expect(entry?.textContent).toContain('Earnings');

    fakeCurrentUser.setAuthenticated(memberUser);
    const other = TestBed.createComponent(AppSidebarComponent);
    await other.whenStable();
    other.detectChanges();
    expect(
      (other.nativeElement as HTMLElement).querySelector(
        '[data-testid="sidebar-nav-item-earnings"]',
      ),
    ).toBeNull();
  });

  // 028-klaro-nav-integration, Edge Case: a broken logo image falls back to
  // the Material Symbols glyph instead of hiding/disabling the entry.
  it('falls back to the app-icon glyph when the Klaro logo image fails to load', async () => {
    fakeCurrentUser.setAuthenticated(klaroUser);
    const fixture = TestBed.createComponent(AppSidebarComponent);
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const klaroEntry = compiled.querySelector('[data-testid="sidebar-nav-item-klaro"]');
    const img = klaroEntry?.querySelector('img.app-nav__logo');
    expect(img).toBeTruthy();

    img?.dispatchEvent(new Event('error'));
    fixture.detectChanges();

    const entryAfterError = compiled.querySelector('[data-testid="sidebar-nav-item-klaro"]');
    expect(entryAfterError?.querySelector('img.app-nav__logo')).toBeFalsy();
    expect(entryAfterError?.querySelector('app-icon')).toBeTruthy();
    // Still selectable — the routerLink wrapper is unaffected by which child renders.
    expect(entryAfterError?.tagName).toBe('A');
    expect(entryAfterError?.getAttribute('href')).toBe('/app/klaro');
  });

  // 041-domain-maintenance-mode: the item stays visible and gets a wrench marker.
  it('keeps a domain in maintenance visible and marks it with the wrench', async () => {
    TestBed.overrideProvider(DomainMaintenanceStore, {
      useValue: { isInMaintenance: (id: string) => id === 'earnings' },
    });
    fakeCurrentUser.setAuthenticated({ ...memberUser, domainScopes: ['earnings', 'klaro'] });
    const fixture = TestBed.createComponent(AppSidebarComponent);
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('[data-testid="sidebar-nav-item-earnings"]')).not.toBeNull();
    expect(
      compiled.querySelector('[data-testid="sidebar-nav-maintenance-earnings"]'),
    ).not.toBeNull();
    expect(compiled.querySelector('[data-testid="sidebar-nav-maintenance-klaro"]')).toBeNull();
  });

  it('never shows a domain in maintenance that the member is not entitled to', async () => {
    TestBed.overrideProvider(DomainMaintenanceStore, {
      useValue: { isInMaintenance: () => true },
    });
    fakeCurrentUser.setAuthenticated(memberUser);
    const fixture = TestBed.createComponent(AppSidebarComponent);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(
      (fixture.nativeElement as HTMLElement).querySelector(
        '[data-testid="sidebar-nav-item-earnings"]',
      ),
    ).toBeNull();
  });
});
