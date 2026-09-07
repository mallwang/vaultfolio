import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CURRENT_USER_SOURCE } from '@vaultfolio/frontend-domain-access';
import { RejectDialogComponent } from './reject-dialog.component';

describe('RejectDialogComponent', () => {
  let fixture: ComponentFixture<RejectDialogComponent>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RejectDialogComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: CURRENT_USER_SOURCE, useValue: { current: () => null } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RejectDialogComponent);
    httpMock = TestBed.inject(HttpTestingController);
    fixture.componentInstance.signupId = 'su-1';
    fixture.componentInstance.signupEmail = 'test@example.com';
    fixture.detectChanges();
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('has correct initial state', () => {
    const comp = fixture.componentInstance;
    expect(comp['reason']()).toBe('');
    expect(comp['submitting']()).toBe(false);
    expect(comp['errorMessage']()).toBeNull();
  });

  describe('close()', () => {
    it('emits visibleChange(false) and resets state', () => {
      const comp = fixture.componentInstance;
      comp['reason'].set('some reason');
      comp['errorMessage'].set('error');

      const emitted: boolean[] = [];
      comp.visibleChange.subscribe((v) => emitted.push(v));

      comp['close']();

      expect(emitted).toEqual([false]);
      expect(comp['reason']()).toBe('');
      expect(comp['errorMessage']()).toBeNull();
    });
  });

  describe('submit()', () => {
    it('does nothing when signupId is null', () => {
      fixture.componentInstance.signupId = null;
      fixture.componentInstance['submit']();
      httpMock.expectNone('/api/signups/su-1/reject');
      expect(fixture.componentInstance['submitting']()).toBe(false);
    });

    it('POSTs with reason body and resets state on success', () => {
      const comp = fixture.componentInstance;
      comp['reason'].set('spam');
      comp['submit']();
      const req = httpMock.expectOne('/api/signups/su-1/reject');
      expect(req.request.body).toEqual({ reason: 'spam' });
      req.flush({});
      // close() resets reason — confirms submit completed successfully
      expect(comp['reason']()).toBe('');
      expect(comp['submitting']()).toBe(false);
    });

    it('POSTs with empty body when reason is blank and resets state', () => {
      const comp = fixture.componentInstance;
      comp['reason'].set('');
      comp['submit']();
      const req = httpMock.expectOne('/api/signups/su-1/reject');
      expect(req.request.body).toEqual({});
      req.flush({});
      expect(comp['submitting']()).toBe(false);
    });

    it('sets errorMessage and submitting=false on error', () => {
      const comp = fixture.componentInstance;
      comp['submit']();
      httpMock
        .expectOne('/api/signups/su-1/reject')
        .error(new ProgressEvent('error'), { status: 500 });
      expect(comp['errorMessage']()).toBeTruthy();
      expect(comp['submitting']()).toBe(false);
    });
  });
});
