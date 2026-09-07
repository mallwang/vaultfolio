import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { SignInComponent } from './sign-in.component';
import { CurrentUserStore } from '../current-user.store';

describe('SignInComponent', () => {
  let fixture: ComponentFixture<SignInComponent>;
  let httpMock: HttpTestingController;

  const mockCurrentUser = { setAuthenticated: vi.fn() };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SignInComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: { get: () => null } } } },
        { provide: CurrentUserStore, useValue: mockCurrentUser },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SignInComponent);
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => {
    httpMock.verify();
    vi.clearAllMocks();
  });

  describe('submit()', () => {
    it('does nothing when already submitting', () => {
      fixture.componentInstance.submitting.set(true);
      fixture.componentInstance.submit();
      httpMock.expectNone('/api/auth/sign-in');
      expect(fixture.componentInstance.errorMessage()).toBeNull();
    });

    it('navigates to /app/dashboard on success', () => {
      const spy = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
      fixture.componentInstance.email = 'user@example.com';
      fixture.componentInstance.password = 'secret';
      fixture.componentInstance.submit();
      httpMock.expectOne('/api/auth/sign-in').flush({ id: 'u1', email: 'user@example.com' });
      expect(spy).toHaveBeenCalledWith('/app/dashboard');
    });

    it('navigates to redirect param when it starts with /app/', async () => {
      await TestBed.resetTestingModule();
      await TestBed.configureTestingModule({
        imports: [SignInComponent],
        providers: [
          provideHttpClient(),
          provideHttpClientTesting(),
          provideRouter([]),
          {
            provide: ActivatedRoute,
            useValue: { snapshot: { queryParamMap: { get: () => '/app/accounts' } } },
          },
          { provide: CurrentUserStore, useValue: mockCurrentUser },
        ],
      }).compileComponents();
      const f2 = TestBed.createComponent(SignInComponent);
      const h2 = TestBed.inject(HttpTestingController);
      f2.detectChanges();
      const spy = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
      f2.componentInstance.email = 'user@example.com';
      f2.componentInstance.password = 'secret';
      f2.componentInstance.submit();
      h2.expectOne('/api/auth/sign-in').flush({ id: 'u1' });
      expect(spy).toHaveBeenCalledWith('/app/accounts');
      h2.verify();
    });

    it('sets errorMessage from body.message on error', () => {
      fixture.componentInstance.email = 'user@example.com';
      fixture.componentInstance.password = 'wrong';
      fixture.componentInstance.submit();
      httpMock
        .expectOne('/api/auth/sign-in')
        .flush({ message: 'Invalid credentials' }, { status: 401, statusText: 'Unauthorized' });
      expect(fixture.componentInstance.errorMessage()).toBe('Invalid credentials');
    });

    it('sets generic errorMessage when body has no message', () => {
      fixture.componentInstance.email = 'user@example.com';
      fixture.componentInstance.password = 'wrong';
      fixture.componentInstance.submit();
      httpMock.expectOne('/api/auth/sign-in').error(new ProgressEvent('error'), { status: 500 });
      expect(fixture.componentInstance.errorMessage()).toBeTruthy();
    });
  });
});
