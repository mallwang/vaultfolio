import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ForgotPasswordComponent } from './forgot-password.component';

describe('ForgotPasswordComponent', () => {
  let fixture: ComponentFixture<ForgotPasswordComponent>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ForgotPasswordComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(ForgotPasswordComponent);
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('submit()', () => {
    it('does nothing when email is empty', () => {
      fixture.componentInstance['email'].set('');
      fixture.componentInstance['submit']();
      httpMock.expectNone('/api/profile/forgot-password');
      expect(fixture.componentInstance['submitted']()).toBe(false);
    });

    it('does nothing when already submitting', () => {
      fixture.componentInstance['email'].set('user@example.com');
      fixture.componentInstance['submitting'].set(true);
      fixture.componentInstance['submit']();
      httpMock.expectNone('/api/profile/forgot-password');
      expect(fixture.componentInstance['submitted']()).toBe(false);
    });

    it('sets submitted=true and submitting=false on success', () => {
      fixture.componentInstance['email'].set('user@example.com');
      fixture.componentInstance['submit']();
      httpMock.expectOne('/api/profile/forgot-password').flush({ accepted: true });
      expect(fixture.componentInstance['submitted']()).toBe(true);
      expect(fixture.componentInstance['submitting']()).toBe(false);
    });

    it('sets submitted=true and submitting=false on error (same behavior)', () => {
      fixture.componentInstance['email'].set('user@example.com');
      fixture.componentInstance['submit']();
      httpMock
        .expectOne('/api/profile/forgot-password')
        .error(new ProgressEvent('error'), { status: 500 });
      expect(fixture.componentInstance['submitted']()).toBe(true);
      expect(fixture.componentInstance['submitting']()).toBe(false);
    });
  });
});
