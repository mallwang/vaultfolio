import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { ResetPasswordComponent } from './reset-password.component';
import { CurrentUserStore } from '../../auth/current-user.store';

function buildFixture(token: string): {
  fixture: ComponentFixture<ResetPasswordComponent>;
  httpMock: HttpTestingController;
} {
  TestBed.configureTestingModule({
    imports: [ResetPasswordComponent],
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideRouter([]),
      { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => token } } } },
      { provide: CurrentUserStore, useValue: { setAuthenticated: vi.fn() } },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(ResetPasswordComponent);
  const httpMock = TestBed.inject(HttpTestingController);
  return { fixture, httpMock };
}

describe('ResetPasswordComponent', () => {
  let fixture: ComponentFixture<ResetPasswordComponent>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    ({ fixture, httpMock } = buildFixture('test-token'));
    fixture.detectChanges();
    httpMock.expectOne('/api/profile/reset-password/token/test-token').flush({ valid: true });
  });

  afterEach(() => {
    httpMock.verify();
    TestBed.resetTestingModule();
  });

  describe('ngOnInit', () => {
    it('sets loading=false on successful token lookup', () => {
      expect(fixture.componentInstance['loading']()).toBe(false);
    });

    it('navigates to /account/link-invalid when token is missing', async () => {
      TestBed.resetTestingModule();
      ({ fixture, httpMock } = buildFixture(''));
      const spy = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
      fixture.detectChanges();
      expect(spy).toHaveBeenCalledWith('/account/link-invalid');
    });

    it('navigates to /account/link-invalid when token lookup fails', async () => {
      TestBed.resetTestingModule();
      ({ fixture, httpMock } = buildFixture('bad-token'));
      const spy = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
      fixture.detectChanges();
      httpMock
        .expectOne('/api/profile/reset-password/token/bad-token')
        .error(new ProgressEvent('error'), { status: 404 });
      expect(spy).toHaveBeenCalledWith('/account/link-invalid');
    });
  });

  describe('submit()', () => {
    it('does nothing when already submitting', () => {
      const comp = fixture.componentInstance;
      comp['submitting'].set(true);
      comp['submit']();
      httpMock.expectNone('/api/profile/reset-password/token/test-token/confirm');
      expect(comp['errorMessage']()).toBeNull();
    });

    it('sets errorMessage when passwords do not match', () => {
      const comp = fixture.componentInstance;
      comp['newPassword'].set('password1');
      comp['confirmPassword'].set('password2');
      comp['submit']();
      expect(comp['errorMessage']()).toBeTruthy();
    });

    it('sets errorMessage when password is too short', () => {
      const comp = fixture.componentInstance;
      comp['newPassword'].set('short');
      comp['confirmPassword'].set('short');
      comp['submit']();
      expect(comp['errorMessage']()).toBeTruthy();
    });

    it('sets errorMessage when password is too long', () => {
      const comp = fixture.componentInstance;
      const longPass = 'a'.repeat(201);
      comp['newPassword'].set(longPass);
      comp['confirmPassword'].set(longPass);
      comp['submit']();
      expect(comp['errorMessage']()).toBeTruthy();
    });

    it('navigates to /app/dashboard on success', () => {
      const spy = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
      const comp = fixture.componentInstance;
      comp['newPassword'].set('ValidPass123');
      comp['confirmPassword'].set('ValidPass123');
      comp['submit']();
      httpMock
        .expectOne('/api/profile/reset-password/token/test-token/confirm')
        .flush({ id: 'u1' });
      expect(spy).toHaveBeenCalledWith('/app/dashboard');
    });

    it('navigates to /account/link-invalid on 410', () => {
      const spy = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
      const comp = fixture.componentInstance;
      comp['newPassword'].set('ValidPass123');
      comp['confirmPassword'].set('ValidPass123');
      comp['submit']();
      httpMock
        .expectOne('/api/profile/reset-password/token/test-token/confirm')
        .error(new ProgressEvent('error'), { status: 410 });
      expect(spy).toHaveBeenCalledWith('/account/link-invalid');
    });

    it('sets errorMessage on other error', () => {
      const comp = fixture.componentInstance;
      comp['newPassword'].set('ValidPass123');
      comp['confirmPassword'].set('ValidPass123');
      comp['submit']();
      httpMock
        .expectOne('/api/profile/reset-password/token/test-token/confirm')
        .error(new ProgressEvent('error'), { status: 500 });
      expect(comp['errorMessage']()).toBeTruthy();
      expect(comp['submitting']()).toBe(false);
    });
  });
});
