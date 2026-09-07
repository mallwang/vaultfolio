import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SignupComponent } from './signup.component';

describe('SignupComponent', () => {
  let fixture: ComponentFixture<SignupComponent>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SignupComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(SignupComponent);
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => httpMock.verify());

  it('initialises with empty state', () => {
    const comp = fixture.componentInstance;
    expect(comp['submitting']()).toBe(false);
    expect(comp['submitted']()).toBe(false);
    expect(comp['errorMessage']()).toBeNull();
  });

  describe('submit() guards', () => {
    it('does nothing when already submitting', () => {
      fixture.componentInstance['submitting'].set(true);
      fixture.componentInstance['submit']();
      httpMock.expectNone('/api/signups');
      expect(fixture.componentInstance['submitting']()).toBe(true);
    });

    it('sets errorMessage when email is blank', () => {
      fixture.componentInstance['email'].set('   ');
      fixture.componentInstance['submit']();
      httpMock.expectNone('/api/signups');
      expect(fixture.componentInstance['errorMessage']()).toBeTruthy();
    });

    it('sets errorMessage when passwords do not match', () => {
      fixture.componentInstance['email'].set('user@example.com');
      fixture.componentInstance['password'].set('password1');
      fixture.componentInstance['confirmPassword'].set('different');
      fixture.componentInstance['submit']();
      httpMock.expectNone('/api/signups');
      expect(fixture.componentInstance['errorMessage']()).toBeTruthy();
    });

    it('sets errorMessage when password is too short', () => {
      fixture.componentInstance['email'].set('user@example.com');
      fixture.componentInstance['password'].set('short');
      fixture.componentInstance['confirmPassword'].set('short');
      fixture.componentInstance['submit']();
      httpMock.expectNone('/api/signups');
      expect(fixture.componentInstance['errorMessage']()).toBeTruthy();
    });

    it('sets errorMessage when password is too long', () => {
      const long = 'a'.repeat(201);
      fixture.componentInstance['email'].set('user@example.com');
      fixture.componentInstance['password'].set(long);
      fixture.componentInstance['confirmPassword'].set(long);
      fixture.componentInstance['submit']();
      httpMock.expectNone('/api/signups');
      expect(fixture.componentInstance['errorMessage']()).toBeTruthy();
    });
  });

  describe('submit() HTTP', () => {
    function fillValid() {
      fixture.componentInstance['email'].set('user@example.com');
      fixture.componentInstance['password'].set('validpassword');
      fixture.componentInstance['confirmPassword'].set('validpassword');
    }

    it('sets submitted=true on success', () => {
      fillValid();
      fixture.componentInstance['submit']();
      httpMock.expectOne('/api/signups').flush({ id: 'su-1' });
      expect(fixture.componentInstance['submitted']()).toBe(true);
      expect(fixture.componentInstance['submitting']()).toBe(false);
    });

    it('sets signup_disabled message on 403 signup_disabled', () => {
      fillValid();
      fixture.componentInstance['submit']();
      httpMock
        .expectOne('/api/signups')
        .flush({ error: 'signup_disabled' }, { status: 403, statusText: 'Forbidden' });
      expect(fixture.componentInstance['errorMessage']()).toBeTruthy();
      expect(fixture.componentInstance['submitting']()).toBe(false);
    });

    it('sets email conflict message on 409', () => {
      fillValid();
      fixture.componentInstance['submit']();
      httpMock.expectOne('/api/signups').flush({}, { status: 409, statusText: 'Conflict' });
      expect(fixture.componentInstance['errorMessage']()).toBeTruthy();
      expect(fixture.componentInstance['submitting']()).toBe(false);
    });

    it('sets server message on other errors', () => {
      fillValid();
      fixture.componentInstance['submit']();
      httpMock
        .expectOne('/api/signups')
        .flush(
          { message: 'Something went wrong' },
          { status: 500, statusText: 'Internal Server Error' },
        );
      expect(fixture.componentInstance['errorMessage']()).toBe('Something went wrong');
      expect(fixture.componentInstance['submitting']()).toBe(false);
    });

    it('falls back to generic message when server error has no message', () => {
      fillValid();
      fixture.componentInstance['submit']();
      httpMock.expectOne('/api/signups').error(new ProgressEvent('error'), { status: 500 });
      expect(fixture.componentInstance['errorMessage']()).toBeTruthy();
      expect(fixture.componentInstance['submitting']()).toBe(false);
    });
  });
});
