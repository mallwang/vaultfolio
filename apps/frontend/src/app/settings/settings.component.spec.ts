import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { SessionUser } from '@vaultfolio/api-contract';
import { SettingsComponent } from './settings.component';
import { CurrentUserStore } from '../auth/current-user.store';
import { FakeCurrentUserStore } from '../auth/testing/current-user-store.testing';
import { SETTINGS_TAB_CONTRIBUTIONS } from './settings-tabs.registry';
import type { SettingsTabContribution } from '@vaultfolio/frontend-domain-access';

@Component({ selector: 'app-stub-tab', template: `stub tab content` })
class StubTabComponent {}

class FakeResizeObserver {
  observe = vi.fn();
  disconnect = vi.fn();
  unobserve = vi.fn();
}

// A throwaway contribution, tied to the 'holdings' domain (an id the fake
// user's `domainScopes` can plausibly carry) — this feature ships the
// mechanism with SETTINGS_TAB_CONTRIBUTIONS empty (data-model.md
// Assumptions), so entitlement-gating itself is exercised by mutating the
// exported (mutable) array directly for the duration of a test, rather than
// via a live registry entry. `vi.mock` cannot target this relative import
// under the Angular unit-test runner.
const scratchContribution: SettingsTabContribution = {
  domainId: 'holdings',
  path: 'holdings',
  labelKey: 'nav.holdings',
  loadComponent: () => Promise.resolve(StubTabComponent),
};

const entitledUser: SessionUser = {
  id: 'user-1',
  email: 'entitled@example.com',
  displayName: 'Entitled',
  role: 'MEMBER',
  domainScopes: ['holdings'],
};

const unentitledUser: SessionUser = {
  id: 'user-2',
  email: 'unentitled@example.com',
  displayName: 'Unentitled',
  role: 'MEMBER',
  domainScopes: [],
};

// 022-add-domain-placeholders, US2 (FR-005): entitled to a new placeholder
// domain and nothing else — Settings has no tab to show for it.
const newDomainOnlyUser: SessionUser = {
  id: 'user-3',
  email: 'new-domain-only@example.com',
  displayName: 'New Domain Only',
  role: 'MEMBER',
  domainScopes: ['retirement'],
};

describe('SettingsComponent', () => {
  let fixture: ComponentFixture<SettingsComponent>;
  let fakeCurrentUser: FakeCurrentUserStore;

  beforeEach(async () => {
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
    fakeCurrentUser = new FakeCurrentUserStore();
    await TestBed.configureTestingModule({
      imports: [SettingsComponent],
      providers: [provideRouter([]), { provide: CurrentUserStore, useValue: fakeCurrentUser }],
    }).compileComponents();
    fixture = TestBed.createComponent(SettingsComponent);
  });

  afterEach(() => {
    SETTINGS_TAB_CONTRIBUTIONS.length = 0;
    vi.unstubAllGlobals();
  });

  it('always shows Profile and Preferences regardless of entitlements (Acceptance Scenario 1)', () => {
    fakeCurrentUser.setAuthenticated(unentitledUser);
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Profile');
    expect(text).toContain('Preferences');
  });

  it('shows a contributed tab when the current user is entitled to its domain (Acceptance Scenario 2)', () => {
    SETTINGS_TAB_CONTRIBUTIONS.push(scratchContribution);
    fakeCurrentUser.setAuthenticated(entitledUser);
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Holdings');
  });

  it('hides a contributed tab when the current user is not entitled to its domain (Acceptance Scenario 3)', () => {
    SETTINGS_TAB_CONTRIBUTIONS.push(scratchContribution);
    fakeCurrentUser.setAuthenticated(unentitledUser);
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).not.toContain('Holdings');
  });

  it('adds no extra tab when no domain contributes one, e.g. holdings per this spec (Acceptance Scenario 5)', () => {
    fakeCurrentUser.setAuthenticated(entitledUser);
    fixture.detectChanges();

    expect(fixture.componentInstance['visibleTabs']()).toEqual([]);
  });

  it('shows only Profile and Preferences for a user entitled to a new placeholder domain and no other domain (FR-005)', () => {
    fakeCurrentUser.setAuthenticated(newDomainOnlyUser);
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Profile');
    expect(text).toContain('Preferences');
    expect(fixture.componentInstance['visibleTabs']()).toEqual([]);
  });
});
