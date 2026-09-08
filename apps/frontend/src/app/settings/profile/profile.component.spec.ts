import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import type { ProfileSummary } from '@vaultfolio/api-contract';
import { ProfileComponent } from './profile.component';
import { CurrentUserStore } from '../../auth/current-user.store';
import { FakeCurrentUserStore } from '../../auth/testing/current-user-store.testing';

const PROFILE: ProfileSummary = {
  id: 'user-1',
  email: 'user@example.com',
  displayName: 'Test User',
  pendingEmail: null,
  emailLanguage: 'en',
  role: 'MEMBER',
};

describe('ProfileComponent', () => {
  let fixture: ComponentFixture<ProfileComponent>;
  let httpMock: HttpTestingController;
  let fakeStore: FakeCurrentUserStore;

  beforeEach(async () => {
    fakeStore = new FakeCurrentUserStore();
    fakeStore.setAuthenticated({
      id: 'user-1',
      email: 'user@example.com',
      displayName: 'Test User',
      role: 'MEMBER',
      domainScopes: [],
    });

    await TestBed.configureTestingModule({
      imports: [ProfileComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: CurrentUserStore, useValue: fakeStore },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ProfileComponent);
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    httpMock.expectOne('/api/profile').flush(PROFILE);
    fixture.detectChanges();
  });

  afterEach(() => httpMock.verify());

  describe('ngOnInit', () => {
    it('loads the profile and sets displayName signal', () => {
      expect(fixture.componentInstance['displayName']()).toBe('Test User');
      expect(fixture.componentInstance['profile']()).toEqual(PROFILE);
      expect(fixture.componentInstance['loading']()).toBe(false);
    });

    it('sets loading=false on fetch error', () => {
      const f2 = TestBed.createComponent(ProfileComponent);
      f2.detectChanges();
      httpMock.expectOne('/api/profile').error(new ProgressEvent('error'), { status: 500 });
      f2.detectChanges();
      expect(f2.componentInstance['loading']()).toBe(false);
    });
  });

  describe('saveDisplayName()', () => {
    it('does nothing when displayName is empty', () => {
      fixture.componentInstance['displayName'].set('   ');
      fixture.componentInstance['saveDisplayName']();
      httpMock.expectNone('/api/profile/display-name');
      expect(fixture.componentInstance['savingName']()).toBe(false);
    });

    it('does nothing when already saving', () => {
      fixture.componentInstance['savingName'].set(true);
      fixture.componentInstance['saveDisplayName']();
      httpMock.expectNone('/api/profile/display-name');
      expect(fixture.componentInstance['savingName']()).toBe(true);
    });

    it('PATCHes display name and updates the store on success', () => {
      fixture.componentInstance['displayName'].set('New Name');
      fixture.componentInstance['saveDisplayName']();
      httpMock
        .expectOne('/api/profile/display-name')
        .flush({ ...PROFILE, displayName: 'New Name' });
      expect(fixture.componentInstance['savingName']()).toBe(false);
      expect(fakeStore.current()?.displayName).toBe('New Name');
    });

    it('shows error toast on failure', () => {
      fixture.componentInstance['displayName'].set('New Name');
      fixture.componentInstance['saveDisplayName']();
      httpMock
        .expectOne('/api/profile/display-name')
        .error(new ProgressEvent('error'), { status: 500 });
      expect(fixture.componentInstance['savingName']()).toBe(false);
    });
  });

  describe('requestEmailChange()', () => {
    it('does nothing when newEmail is empty', () => {
      fixture.componentInstance['newEmail'].set('  ');
      fixture.componentInstance['requestEmailChange']();
      httpMock.expectNone('/api/profile/email-change');
      expect(fixture.componentInstance['requestingEmailChange']()).toBe(false);
    });

    it('does nothing when already requesting', () => {
      fixture.componentInstance['requestingEmailChange'].set(true);
      fixture.componentInstance['requestEmailChange']();
      httpMock.expectNone('/api/profile/email-change');
      expect(fixture.componentInstance['requestingEmailChange']()).toBe(true);
    });

    it('POSTs and refreshes on success', () => {
      fixture.componentInstance['newEmail'].set('new@example.com');
      fixture.componentInstance['requestEmailChange']();
      httpMock.expectOne('/api/profile/email-change').flush({ pendingEmail: 'new@example.com' });
      // refresh call
      httpMock.expectOne('/api/profile').flush(PROFILE);
      expect(fixture.componentInstance['newEmail']()).toBe('');
    });

    it('sets emailUnavailable message on 409', () => {
      fixture.componentInstance['newEmail'].set('taken@example.com');
      fixture.componentInstance['requestEmailChange']();
      httpMock
        .expectOne('/api/profile/email-change')
        .flush({}, { status: 409, statusText: 'Conflict' });
      expect(fixture.componentInstance['emailErrorMessage']()).toBeTruthy();
    });

    it('sets delivery failed message on 502', () => {
      fixture.componentInstance['newEmail'].set('bad@example.com');
      fixture.componentInstance['requestEmailChange']();
      httpMock
        .expectOne('/api/profile/email-change')
        .flush({ message: 'Delivery failed' }, { status: 502, statusText: 'Bad Gateway' });
      httpMock.expectOne('/api/profile').flush(PROFILE);
      expect(fixture.componentInstance['emailErrorMessage']()).toBe('Delivery failed');
    });

    it('sets generic error message on other errors', () => {
      fixture.componentInstance['newEmail'].set('err@example.com');
      fixture.componentInstance['requestEmailChange']();
      httpMock
        .expectOne('/api/profile/email-change')
        .error(new ProgressEvent('error'), { status: 500 });
      expect(fixture.componentInstance['emailErrorMessage']()).toBeTruthy();
    });
  });

  describe('cancelEmailChange()', () => {
    it('POSTs cancel and refreshes on success', () => {
      fixture.componentInstance['cancelEmailChange']();
      httpMock.expectOne('/api/profile/email-change/cancel').flush({});
      httpMock.expectOne('/api/profile').flush(PROFILE);
      expect(fixture.componentInstance['loading']()).toBe(false);
    });

    it('shows error toast on failure', () => {
      fixture.componentInstance['cancelEmailChange']();
      httpMock
        .expectOne('/api/profile/email-change/cancel')
        .error(new ProgressEvent('error'), { status: 500 });
      expect(fixture.componentInstance['loading']()).toBe(false);
    });
  });

  describe('changePassword()', () => {
    it('does nothing when already changing', () => {
      fixture.componentInstance['changingPassword'].set(true);
      fixture.componentInstance['changePassword']();
      httpMock.expectNone('/api/profile/password');
      expect(fixture.componentInstance['changingPassword']()).toBe(true);
    });

    it('sets passwordsDoNotMatch error when passwords differ', () => {
      fixture.componentInstance['newPassword'].set('password1');
      fixture.componentInstance['confirmNewPassword'].set('password2');
      fixture.componentInstance['changePassword']();
      expect(fixture.componentInstance['passwordErrorMessage']()).toBeTruthy();
    });

    it('sets passwordLengthError when password is too short', () => {
      fixture.componentInstance['newPassword'].set('short');
      fixture.componentInstance['confirmNewPassword'].set('short');
      fixture.componentInstance['changePassword']();
      expect(fixture.componentInstance['passwordErrorMessage']()).toBeTruthy();
    });

    it('POSTs password change and clears fields on success', () => {
      fixture.componentInstance['currentPassword'].set('oldpass');
      fixture.componentInstance['newPassword'].set('newpassword');
      fixture.componentInstance['confirmNewPassword'].set('newpassword');
      fixture.componentInstance['changePassword']();
      httpMock.expectOne('/api/profile/password').flush({ changed: true });
      expect(fixture.componentInstance['newPassword']()).toBe('');
      expect(fixture.componentInstance['currentPassword']()).toBe('');
    });

    it('sets currentPasswordError on 401', () => {
      fixture.componentInstance['newPassword'].set('newpassword');
      fixture.componentInstance['confirmNewPassword'].set('newpassword');
      fixture.componentInstance['changePassword']();
      httpMock
        .expectOne('/api/profile/password')
        .flush({}, { status: 401, statusText: 'Unauthorized' });
      expect(fixture.componentInstance['currentPasswordError']()).toBe(true);
    });

    it('sets passwordLengthError on 400', () => {
      fixture.componentInstance['newPassword'].set('newpassword');
      fixture.componentInstance['confirmNewPassword'].set('newpassword');
      fixture.componentInstance['changePassword']();
      httpMock
        .expectOne('/api/profile/password')
        .flush({}, { status: 400, statusText: 'Bad Request' });
      expect(fixture.componentInstance['passwordErrorMessage']()).toBeTruthy();
    });

    it('sets generic error message on unknown error', () => {
      fixture.componentInstance['newPassword'].set('newpassword');
      fixture.componentInstance['confirmNewPassword'].set('newpassword');
      fixture.componentInstance['changePassword']();
      httpMock
        .expectOne('/api/profile/password')
        .error(new ProgressEvent('error'), { status: 500 });
      expect(fixture.componentInstance['passwordErrorMessage']()).toBeTruthy();
    });
  });

  // TODO(029-export-data, T047): "Export my data" component test — see
  // https://github.com/mallwang/vaultfolio/issues (tracking issue) for the vi.mock hoisting
  // problem this hit and what's left to finish it.

  describe('danger zone', () => {
    it('openDangerZone() sets step to advisory', () => {
      fixture.componentInstance['openDangerZone']();
      expect(fixture.componentInstance['dangerStep']()).toBe('advisory');
    });

    it('closeDangerZone() resets step to closed', () => {
      fixture.componentInstance['dangerStep'].set('advisory');
      fixture.componentInstance['closeDangerZone']();
      expect(fixture.componentInstance['dangerStep']()).toBe('closed');
    });

    it('proceedToConfirm() sets step to confirm', () => {
      fixture.componentInstance['proceedToConfirm']();
      expect(fixture.componentInstance['dangerStep']()).toBe('confirm');
    });

    it('confirmDeleteAccount() does nothing when confirm text is wrong', () => {
      fixture.componentInstance['deleteConfirmText'].set('NOPE');
      fixture.componentInstance['confirmDeleteAccount']();
      httpMock.expectNone('/api/profile/account');
      expect(fixture.componentInstance['deleting']()).toBe(false);
    });

    it('confirmDeleteAccount() does nothing when already deleting', () => {
      fixture.componentInstance['deleteConfirmText'].set('DELETE');
      fixture.componentInstance['deleting'].set(true);
      fixture.componentInstance['confirmDeleteAccount']();
      httpMock.expectNone('/api/profile/account');
      expect(fixture.componentInstance['deleting']()).toBe(true);
    });

    it('DELETEs account and navigates to sign-in on success', () => {
      const spy = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
      fixture.componentInstance['deleteConfirmText'].set('DELETE');
      fixture.componentInstance['confirmDeleteAccount']();
      httpMock.expectOne('/api/profile/account').flush(null);
      expect(spy).toHaveBeenCalledWith('/sign-in');
    });

    it('sets step to blocked on 409', () => {
      fixture.componentInstance['deleteConfirmText'].set('DELETE');
      fixture.componentInstance['confirmDeleteAccount']();
      httpMock.expectOne('/api/profile/account').flush({}, { status: 409, statusText: 'Conflict' });
      expect(fixture.componentInstance['dangerStep']()).toBe('blocked');
    });

    it('sets deleteErrorMessage on generic error', () => {
      fixture.componentInstance['deleteConfirmText'].set('DELETE');
      fixture.componentInstance['confirmDeleteAccount']();
      httpMock.expectOne('/api/profile/account').error(new ProgressEvent('error'), { status: 500 });
      expect(fixture.componentInstance['deleteErrorMessage']()).toBeTruthy();
    });
  });
});
