import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import type {
  ChangePasswordRequest,
  ForgotPasswordRequest,
  ProfileSummary,
  RequestEmailChangeRequest,
  ResetPasswordRequest,
  SessionUser,
  UpdateDisplayNameRequest,
} from '@vaultfolio/api-contract';

/**
 * `HttpClient` wrapper for `/api/profile/*` (contracts/profile-api.md), User
 * Stories 1–3. Same relative-`/api/...` pattern as `AccountsService`/
 * `InvitationsService`. The `token/*`/forgot-password methods are the
 * public, unauthenticated routes.
 */
@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/profile';

  getProfile(): Observable<ProfileSummary> {
    return this.http.get<ProfileSummary>(this.baseUrl);
  }

  updateDisplayName(body: UpdateDisplayNameRequest): Observable<ProfileSummary> {
    return this.http.patch<ProfileSummary>(`${this.baseUrl}/display-name`, body);
  }

  requestEmailChange(body: RequestEmailChangeRequest): Observable<{ pendingEmail: string }> {
    return this.http.post<{ pendingEmail: string }>(`${this.baseUrl}/email-change`, body);
  }

  cancelEmailChange(): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/email-change/cancel`, {});
  }

  lookupEmailChangeToken(token: string): Observable<{ newEmail: string }> {
    return this.http.get<{ newEmail: string }>(`${this.baseUrl}/email-change/token/${token}`);
  }

  confirmEmailChange(token: string): Observable<{ email: string }> {
    return this.http.post<{ email: string }>(
      `${this.baseUrl}/email-change/token/${token}/confirm`,
      {},
    );
  }

  changePassword(body: ChangePasswordRequest): Observable<{ changed: true }> {
    return this.http.post<{ changed: true }>(`${this.baseUrl}/password`, body);
  }

  requestPasswordReset(body: ForgotPasswordRequest): Observable<{ accepted: true }> {
    return this.http.post<{ accepted: true }>(`${this.baseUrl}/forgot-password`, body);
  }

  lookupResetToken(token: string): Observable<{ valid: true }> {
    return this.http.get<{ valid: true }>(`${this.baseUrl}/reset-password/token/${token}`);
  }

  confirmPasswordReset(token: string, body: ResetPasswordRequest): Observable<SessionUser> {
    return this.http.post<SessionUser>(
      `${this.baseUrl}/reset-password/token/${token}/confirm`,
      body,
    );
  }

  deleteAccount(): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/account`);
  }
}
