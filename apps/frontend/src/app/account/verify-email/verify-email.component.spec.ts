import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { VerifyEmailComponent } from './verify-email.component';

function buildFixture(token: string): {
  fixture: ComponentFixture<VerifyEmailComponent>;
  httpMock: HttpTestingController;
} {
  TestBed.configureTestingModule({
    imports: [VerifyEmailComponent],
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideRouter([]),
      { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => token } } } },
    ],
  }).compileComponents();

  return {
    fixture: TestBed.createComponent(VerifyEmailComponent),
    httpMock: TestBed.inject(HttpTestingController),
  };
}

describe('VerifyEmailComponent', () => {
  let fixture: ComponentFixture<VerifyEmailComponent>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    ({ fixture, httpMock } = buildFixture('test-token'));
    fixture.detectChanges();
    httpMock
      .expectOne('/api/profile/email-change/token/test-token')
      .flush({ newEmail: 'new@example.com' });
  });

  afterEach(() => {
    httpMock.verify();
    TestBed.resetTestingModule();
  });

  describe('ngOnInit', () => {
    it('sets newEmail and state=ready on success', () => {
      expect(fixture.componentInstance['newEmail']()).toBe('new@example.com');
      expect(fixture.componentInstance['state']()).toBe('ready');
    });

    it('navigates to /account/link-invalid when token is missing', () => {
      TestBed.resetTestingModule();
      ({ fixture, httpMock } = buildFixture(''));
      const spy = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
      fixture.detectChanges();
      expect(spy).toHaveBeenCalledWith('/account/link-invalid');
    });

    it('navigates to /account/link-invalid on token lookup error', () => {
      TestBed.resetTestingModule();
      ({ fixture, httpMock } = buildFixture('bad-token'));
      const spy = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
      fixture.detectChanges();
      httpMock
        .expectOne('/api/profile/email-change/token/bad-token')
        .error(new ProgressEvent('error'), { status: 404 });
      expect(spy).toHaveBeenCalledWith('/account/link-invalid');
    });
  });

  describe('confirm()', () => {
    it('does nothing when already confirming', () => {
      const comp = fixture.componentInstance;
      comp['confirming'].set(true);
      comp['confirm']();
      httpMock.expectNone('/api/profile/email-change/token/test-token/confirm');
      expect(comp['confirmedEmail']()).toBeNull();
    });

    it('sets confirmedEmail on success', () => {
      fixture.componentInstance['confirm']();
      httpMock
        .expectOne('/api/profile/email-change/token/test-token/confirm')
        .flush({ email: 'new@example.com' });
      expect(fixture.componentInstance['confirmedEmail']()).toBe('new@example.com');
    });

    it('navigates to /account/link-invalid on error', () => {
      const spy = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
      fixture.componentInstance['confirm']();
      httpMock
        .expectOne('/api/profile/email-change/token/test-token/confirm')
        .error(new ProgressEvent('error'), { status: 410 });
      expect(spy).toHaveBeenCalledWith('/account/link-invalid');
    });
  });
});
