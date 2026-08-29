import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import type {
  AcceptInvitationRequest,
  CreateInvitationRequest,
  InvitationSummary,
  InvitationTokenLookup,
  SessionUser,
} from '@vaultfolio/api-contract';

/**
 * `HttpClient` wrapper for `/api/invitations/*` (contracts/invitations-api.md),
 * User Story 2. Same relative-`/api/...` pattern as `AccountsService`. The
 * `token/*` methods are the public, unauthenticated invitee-facing routes.
 */
@Injectable({ providedIn: 'root' })
export class InvitationsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/invitations';

  list(): Observable<InvitationSummary[]> {
    return this.http.get<InvitationSummary[]>(this.baseUrl);
  }

  create(body: CreateInvitationRequest): Observable<InvitationSummary> {
    return this.http.post<InvitationSummary>(this.baseUrl, body);
  }

  cancel(id: string): Observable<InvitationSummary> {
    return this.http.post<InvitationSummary>(`${this.baseUrl}/${id}/cancel`, {});
  }

  resend(id: string): Observable<InvitationSummary> {
    return this.http.post<InvitationSummary>(`${this.baseUrl}/${id}/resend`, {});
  }

  lookupToken(token: string): Observable<InvitationTokenLookup> {
    return this.http.get<InvitationTokenLookup>(`${this.baseUrl}/token/${token}`);
  }

  accept(token: string, body: AcceptInvitationRequest): Observable<SessionUser> {
    return this.http.post<SessionUser>(`${this.baseUrl}/token/${token}/accept`, body);
  }
}
