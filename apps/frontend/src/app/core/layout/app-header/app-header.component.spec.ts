import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import type { SessionUser } from '@vaultfolio/api-contract';
import { AppHeaderComponent } from './app-header.component';
import { CurrentUserStore } from '../../../auth/current-user.store';
import { FakeCurrentUserStore } from '../../../auth/testing/current-user-store.testing';

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
});
