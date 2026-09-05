import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { SessionUser } from '@vaultfolio/api-contract';
import { App } from './app';
import { CurrentUserStore } from './auth/current-user.store';
import { FakeCurrentUserStore } from './auth/testing/current-user-store.testing';

const user: SessionUser = {
  id: 'user-1',
  email: 'alex@example.com',
  displayName: 'Alex Example',
  role: 'MEMBER',
  domainScopes: [],
};

describe('App', () => {
  let fakeCurrentUser: FakeCurrentUserStore;

  beforeEach(async () => {
    fakeCurrentUser = new FakeCurrentUserStore();
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: CurrentUserStore, useValue: fakeCurrentUser },
      ],
    }).compileComponents();
  });

  it('renders the header on a public route with no identity content while unauthenticated', async () => {
    fakeCurrentUser.setUnauthenticated();
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('app-header')).toBeTruthy();
    expect(compiled.querySelector('.app-header__meta')).toBeFalsy();
  });

  it('renders the header with no identity content while Auth Status is unknown', async () => {
    fakeCurrentUser.setUnknown();
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('app-header')).toBeTruthy();
    expect(compiled.querySelector('.app-header__meta')).toBeFalsy();
  });

  it('renders the header with identity content once authenticated', async () => {
    fakeCurrentUser.setAuthenticated(user);
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('app-header')).toBeTruthy();
    expect(compiled.querySelector('.app-header__meta')).toBeTruthy();
    expect(compiled.textContent).toContain('Alex Example');
  });
});
