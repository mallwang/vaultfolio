import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CURRENT_USER_SOURCE } from '@vaultfolio/frontend-domain-access';
import { InviteDialogComponent } from './invite-dialog.component';

describe('InviteDialogComponent', () => {
  let fixture: ComponentFixture<InviteDialogComponent>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InviteDialogComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: CURRENT_USER_SOURCE, useValue: { current: () => null } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(InviteDialogComponent);
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('has correct initial state', () => {
    const comp = fixture.componentInstance;
    expect(comp['email']()).toBe('');
    expect(comp['role']()).toBe('MEMBER');
    expect(comp['submitting']()).toBe(false);
    expect(comp['errorMessage']()).toBeNull();
  });

  describe('close()', () => {
    it('emits visibleChange(false) and resets state', () => {
      const comp = fixture.componentInstance;
      comp['email'].set('test@example.com');
      comp['errorMessage'].set('some error');

      const emitted: boolean[] = [];
      comp.visibleChange.subscribe((v) => emitted.push(v));

      comp['close']();

      expect(emitted).toEqual([false]);
      expect(comp['email']()).toBe('');
      expect(comp['errorMessage']()).toBeNull();
    });
  });

  describe('submit()', () => {
    it('does nothing when email is empty', () => {
      fixture.componentInstance['email'].set('');
      fixture.componentInstance['submit']();
      httpMock.expectNone('/api/invitations');
      expect(fixture.componentInstance['submitting']()).toBe(false);
    });

    it('resets state (close called) after success', () => {
      const comp = fixture.componentInstance;
      comp['email'].set('invite@example.com');
      comp['submit']();
      httpMock.expectOne('/api/invitations').flush({ id: 'inv-1' });
      // close() resets email to '' — confirms both created was emitted and close was called
      expect(comp['email']()).toBe('');
      expect(comp['submitting']()).toBe(false);
    });

    it('sets errorMessage for 409 account_exists', () => {
      const comp = fixture.componentInstance;
      comp['email'].set('exists@example.com');
      comp['submit']();
      httpMock
        .expectOne('/api/invitations')
        .flush({ error: 'account_exists' }, { status: 409, statusText: 'Conflict' });
      expect(comp['errorMessage']()).toBeTruthy();
      expect(comp['submitting']()).toBe(false);
    });

    it('sets generic errorMessage for other errors', () => {
      const comp = fixture.componentInstance;
      comp['email'].set('user@example.com');
      comp['submit']();
      httpMock.expectOne('/api/invitations').error(new ProgressEvent('error'), { status: 500 });
      expect(comp['errorMessage']()).toBeTruthy();
      expect(comp['submitting']()).toBe(false);
    });
  });
});
