import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { ProfileSummary, SessionUser } from '@vaultfolio/api-contract';
import { ProfileService } from './profile.service';

describe('ProfileService', () => {
  let service: ProfileService;
  let httpMock: HttpTestingController;

  const profile: ProfileSummary = {
    id: 'user-1',
    email: 'user@example.com',
    displayName: 'User',
    role: 'MEMBER',
    pendingEmail: null,
    emailLanguage: null,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ProfileService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('getProfile() issues a GET to /api/profile', () => {
    let result: ProfileSummary | undefined;
    service.getProfile().subscribe((res) => (result = res));

    const req = httpMock.expectOne('/api/profile');
    expect(req.request.method).toBe('GET');
    req.flush(profile);

    expect(result).toEqual(profile);
  });

  it('getProfile() propagates an error', () => {
    let error: unknown;
    service.getProfile().subscribe({ error: (err) => (error = err) });

    httpMock.expectOne('/api/profile').error(new ProgressEvent('error'), { status: 500 });

    expect(error).toBeDefined();
  });

  it('updateDisplayName() issues a PATCH to /api/profile/display-name', () => {
    let result: ProfileSummary | undefined;
    service.updateDisplayName({ displayName: 'New Name' }).subscribe((res) => (result = res));

    const req = httpMock.expectOne('/api/profile/display-name');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ displayName: 'New Name' });
    req.flush({ ...profile, displayName: 'New Name' });

    expect(result?.displayName).toBe('New Name');
  });

  it('updateDisplayName() propagates an error', () => {
    let error: unknown;
    service.updateDisplayName({ displayName: 'New Name' }).subscribe({
      error: (err) => (error = err),
    });

    httpMock
      .expectOne('/api/profile/display-name')
      .error(new ProgressEvent('error'), { status: 400 });

    expect(error).toBeDefined();
  });

  it('updateEmailLanguage() issues a PATCH to /api/profile/email-language', () => {
    let result: ProfileSummary | undefined;
    service.updateEmailLanguage({ emailLanguage: 'de' }).subscribe((res) => (result = res));

    const req = httpMock.expectOne('/api/profile/email-language');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ emailLanguage: 'de' });
    req.flush({ ...profile, emailLanguage: 'de' });

    expect(result?.emailLanguage).toBe('de');
  });

  it('updateEmailLanguage() propagates an error', () => {
    let error: unknown;
    service.updateEmailLanguage({ emailLanguage: 'de' }).subscribe({
      error: (err) => (error = err),
    });

    httpMock
      .expectOne('/api/profile/email-language')
      .error(new ProgressEvent('error'), { status: 400 });

    expect(error).toBeDefined();
  });

  it('requestEmailChange() issues a POST to /api/profile/email-change', () => {
    let result: { pendingEmail: string } | undefined;
    service.requestEmailChange({ newEmail: 'new@example.com' }).subscribe((res) => (result = res));

    const req = httpMock.expectOne('/api/profile/email-change');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ newEmail: 'new@example.com' });
    req.flush({ pendingEmail: 'new@example.com' });

    expect(result).toEqual({ pendingEmail: 'new@example.com' });
  });

  it('requestEmailChange() propagates an error', () => {
    let error: unknown;
    service.requestEmailChange({ newEmail: 'new@example.com' }).subscribe({
      error: (err) => (error = err),
    });

    httpMock
      .expectOne('/api/profile/email-change')
      .error(new ProgressEvent('error'), { status: 409 });

    expect(error).toBeDefined();
  });

  it('cancelEmailChange() issues a POST to /api/profile/email-change/cancel', () => {
    let completed = false;
    service.cancelEmailChange().subscribe(() => (completed = true));

    const req = httpMock.expectOne('/api/profile/email-change/cancel');
    expect(req.request.method).toBe('POST');
    req.flush(null);

    expect(completed).toBe(true);
  });

  it('cancelEmailChange() propagates an error', () => {
    let error: unknown;
    service.cancelEmailChange().subscribe({ error: (err) => (error = err) });

    httpMock
      .expectOne('/api/profile/email-change/cancel')
      .error(new ProgressEvent('error'), { status: 500 });

    expect(error).toBeDefined();
  });

  it('lookupEmailChangeToken() issues a GET to /api/profile/email-change/token/:token', () => {
    let result: { newEmail: string } | undefined;
    service.lookupEmailChangeToken('tok123').subscribe((res) => (result = res));

    const req = httpMock.expectOne('/api/profile/email-change/token/tok123');
    expect(req.request.method).toBe('GET');
    req.flush({ newEmail: 'new@example.com' });

    expect(result).toEqual({ newEmail: 'new@example.com' });
  });

  it('lookupEmailChangeToken() propagates an error', () => {
    let error: unknown;
    service.lookupEmailChangeToken('bad-token').subscribe({ error: (err) => (error = err) });

    httpMock
      .expectOne('/api/profile/email-change/token/bad-token')
      .error(new ProgressEvent('error'), { status: 410 });

    expect(error).toBeDefined();
  });

  it('confirmEmailChange() issues a POST to /api/profile/email-change/token/:token/confirm', () => {
    let result: { email: string } | undefined;
    service.confirmEmailChange('tok123').subscribe((res) => (result = res));

    const req = httpMock.expectOne('/api/profile/email-change/token/tok123/confirm');
    expect(req.request.method).toBe('POST');
    req.flush({ email: 'new@example.com' });

    expect(result).toEqual({ email: 'new@example.com' });
  });

  it('confirmEmailChange() propagates an error', () => {
    let error: unknown;
    service.confirmEmailChange('bad-token').subscribe({ error: (err) => (error = err) });

    httpMock
      .expectOne('/api/profile/email-change/token/bad-token/confirm')
      .error(new ProgressEvent('error'), { status: 410 });

    expect(error).toBeDefined();
  });

  it('changePassword() issues a POST to /api/profile/password', () => {
    let result: { changed: true } | undefined;
    service
      .changePassword({ currentPassword: 'old', newPassword: 'new' })
      .subscribe((res) => (result = res));

    const req = httpMock.expectOne('/api/profile/password');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ currentPassword: 'old', newPassword: 'new' });
    req.flush({ changed: true });

    expect(result).toEqual({ changed: true });
  });

  it('changePassword() propagates an error', () => {
    let error: unknown;
    service.changePassword({ currentPassword: 'old', newPassword: 'new' }).subscribe({
      error: (err) => (error = err),
    });

    httpMock.expectOne('/api/profile/password').error(new ProgressEvent('error'), { status: 400 });

    expect(error).toBeDefined();
  });

  it('requestPasswordReset() issues a POST to /api/profile/forgot-password', () => {
    let result: { accepted: true } | undefined;
    service
      .requestPasswordReset({ email: 'user@example.com', turnstileToken: 'tk' })
      .subscribe((res) => (result = res));

    const req = httpMock.expectOne('/api/profile/forgot-password');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ email: 'user@example.com', turnstileToken: 'tk' });
    req.flush({ accepted: true });

    expect(result).toEqual({ accepted: true });
  });

  it('requestPasswordReset() propagates an error', () => {
    let error: unknown;
    service.requestPasswordReset({ email: 'user@example.com', turnstileToken: 'tk' }).subscribe({
      error: (err) => (error = err),
    });

    httpMock
      .expectOne('/api/profile/forgot-password')
      .error(new ProgressEvent('error'), { status: 400 });

    expect(error).toBeDefined();
  });

  it('lookupResetToken() issues a GET to /api/profile/reset-password/token/:token', () => {
    let result: { valid: true } | undefined;
    service.lookupResetToken('tok123').subscribe((res) => (result = res));

    const req = httpMock.expectOne('/api/profile/reset-password/token/tok123');
    expect(req.request.method).toBe('GET');
    req.flush({ valid: true });

    expect(result).toEqual({ valid: true });
  });

  it('lookupResetToken() propagates an error', () => {
    let error: unknown;
    service.lookupResetToken('bad-token').subscribe({ error: (err) => (error = err) });

    httpMock
      .expectOne('/api/profile/reset-password/token/bad-token')
      .error(new ProgressEvent('error'), { status: 410 });

    expect(error).toBeDefined();
  });

  it('confirmPasswordReset() issues a POST to /api/profile/reset-password/token/:token/confirm', () => {
    const user: SessionUser = {
      id: 'user-1',
      email: 'user@example.com',
      displayName: 'User',
      role: 'MEMBER',
      domainScopes: [],
    };
    let result: SessionUser | undefined;
    service
      .confirmPasswordReset('tok123', { newPassword: 'new-pass' })
      .subscribe((res) => (result = res));

    const req = httpMock.expectOne('/api/profile/reset-password/token/tok123/confirm');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ newPassword: 'new-pass' });
    req.flush(user);

    expect(result).toEqual(user);
  });

  it('confirmPasswordReset() propagates an error', () => {
    let error: unknown;
    service.confirmPasswordReset('bad-token', { newPassword: 'new-pass' }).subscribe({
      error: (err) => (error = err),
    });

    httpMock
      .expectOne('/api/profile/reset-password/token/bad-token/confirm')
      .error(new ProgressEvent('error'), { status: 410 });

    expect(error).toBeDefined();
  });

  it('deleteAccount() issues a DELETE to /api/profile/account', () => {
    let completed = false;
    service.deleteAccount().subscribe(() => (completed = true));

    const req = httpMock.expectOne('/api/profile/account');
    expect(req.request.method).toBe('DELETE');
    req.flush(null);

    expect(completed).toBe(true);
  });

  it('deleteAccount() propagates an error', () => {
    let error: unknown;
    service.deleteAccount().subscribe({ error: (err) => (error = err) });

    httpMock.expectOne('/api/profile/account').error(new ProgressEvent('error'), { status: 500 });

    expect(error).toBeDefined();
  });
});
