import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import type { SessionUser } from '@vaultfolio/api-contract';
import { AppHeaderComponent } from './app-header.component';
import { CurrentUserStore } from '../../../auth/current-user.store';
import { FakeCurrentUserStore } from '../../../auth/testing/current-user-store.testing';
import { ThemeService } from '../../theme/theme.service';

const user: SessionUser = {
  id: 'user-1',
  email: 'alex@example.com',
  displayName: 'Alex Example',
  role: 'ADMIN',
};

describe('AppHeaderComponent (integration)', () => {
  let fakeCurrentUser: FakeCurrentUserStore;
  let httpMock: HttpTestingController;
  let router: Router;

  beforeEach(async () => {
    localStorage.clear();
    // jsdom doesn't implement matchMedia; ThemeService (injected by
    // AppHeaderComponent) needs it to resolve the initial theme.
    window.matchMedia = vi
      .fn()
      .mockReturnValue({ matches: false }) as unknown as typeof window.matchMedia;
    fakeCurrentUser = new FakeCurrentUserStore();
    await TestBed.configureTestingModule({
      imports: [AppHeaderComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: CurrentUserStore, useValue: fakeCurrentUser },
      ],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
  });

  afterEach(() => {
    document.documentElement.classList.remove('app-dark');
    httpMock.verify();
  });

  it('shows the display name and role badge while signed in', async () => {
    fakeCurrentUser.setAuthenticated(user);
    const fixture = TestBed.createComponent(AppHeaderComponent);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.textContent).toContain('Alex Example');
    expect(compiled.textContent).toContain('Admin');
  });

  it('clears Auth Status and navigates to /sign-in when sign-out succeeds, hiding identity content afterward', async () => {
    fakeCurrentUser.setAuthenticated(user);
    const fixture = TestBed.createComponent(AppHeaderComponent);
    await fixture.whenStable();
    const navigateSpy = vi.spyOn(router, 'navigateByUrl');

    const signOutButton = (fixture.nativeElement as HTMLElement).querySelector(
      'p-button button',
    ) as HTMLButtonElement;
    signOutButton.click();

    const req = httpMock.expectOne('/api/auth/sign-out');
    req.flush(null);
    fixture.detectChanges();

    expect(fakeCurrentUser.status()).toBe('unauthenticated');
    expect(navigateSpy).toHaveBeenCalledWith('/sign-in');

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.app-header__meta')).toBeFalsy();
  });

  it('renders the theme toggle alone in the header when signed out', async () => {
    fakeCurrentUser.setUnauthenticated();
    const fixture = TestBed.createComponent(AppHeaderComponent);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;

    const toggle = compiled.querySelector('[data-testid="theme-toggle"]') as HTMLElement;
    expect(toggle).toBeTruthy();
    expect(compiled.querySelector('.app-header__meta')).toBeFalsy();
  });

  it('renders the theme toggle inside app-header__meta, immediately before Sign out, when signed in', async () => {
    fakeCurrentUser.setAuthenticated(user);
    const fixture = TestBed.createComponent(AppHeaderComponent);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;

    const meta = compiled.querySelector('.app-header__meta') as HTMLElement;
    expect(meta).toBeTruthy();
    const children = Array.from(meta.children);
    const toggleIndex = children.findIndex(
      (el) => el.getAttribute('data-testid') === 'theme-toggle',
    );
    const signOutIndex = children.findIndex((el) => el.getAttribute('aria-label') === 'Sign out');
    expect(toggleIndex).toBeGreaterThanOrEqual(0);
    expect(signOutIndex).toBeGreaterThan(toggleIndex);
  });

  it('clicking the theme toggle calls ThemeService.toggle()', async () => {
    fakeCurrentUser.setUnauthenticated();
    const fixture = TestBed.createComponent(AppHeaderComponent);
    await fixture.whenStable();
    const themeService = TestBed.inject(ThemeService);
    const toggleSpy = vi.spyOn(themeService, 'toggle');

    const compiled = fixture.nativeElement as HTMLElement;
    const toggle = compiled.querySelector('[data-testid="theme-toggle"]') as HTMLElement;
    toggle.click();

    expect(toggleSpy).toHaveBeenCalledTimes(1);
  });

  it('reflects the current theme in aria-pressed and aria-label, flipping after a click', async () => {
    localStorage.clear();
    fakeCurrentUser.setUnauthenticated();
    const fixture = TestBed.createComponent(AppHeaderComponent);
    await fixture.whenStable();

    const compiled = fixture.nativeElement as HTMLElement;
    const toggle = compiled.querySelector('[data-testid="theme-toggle"]') as HTMLElement;

    expect(toggle.getAttribute('aria-pressed')).toBe('false');
    expect(toggle.getAttribute('aria-label')).toBe('Switch to dark theme');

    toggle.click();
    fixture.detectChanges();

    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    expect(toggle.getAttribute('aria-label')).toBe('Switch to light theme');
  });

  it('US3: keeps the app-dark class unaffected by authentication-state transitions', async () => {
    localStorage.setItem('vaultfolio-theme', 'dark');
    fakeCurrentUser.setUnauthenticated();
    const fixture = TestBed.createComponent(AppHeaderComponent);
    await fixture.whenStable();

    expect(document.documentElement.classList.contains('app-dark')).toBe(true);

    fakeCurrentUser.setAuthenticated(user);
    fixture.detectChanges();
    expect(document.documentElement.classList.contains('app-dark')).toBe(true);

    fakeCurrentUser.setUnauthenticated();
    fixture.detectChanges();
    expect(document.documentElement.classList.contains('app-dark')).toBe(true);
  });
});
