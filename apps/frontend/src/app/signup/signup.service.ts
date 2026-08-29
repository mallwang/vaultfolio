import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import type { CreateSignupRequest, SignupSubmitted } from '@vaultfolio/api-contract';

/**
 * `HttpClient` wrapper for the visitor-facing `/api/signups*` routes
 * (contracts/signups-api.md), User Story 1. Same relative-`/api/...`
 * pattern as `InvitationsService`'s public `token/*` methods — no session.
 */
@Injectable({ providedIn: 'root' })
export class SignupService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/signups';

  submit(body: CreateSignupRequest): Observable<SignupSubmitted> {
    return this.http.post<SignupSubmitted>(this.baseUrl, body);
  }

  lookupToken(token: string): Observable<{ email: string }> {
    return this.http.get<{ email: string }>(`${this.baseUrl}/token/${token}`);
  }

  verify(token: string): Observable<{ email: string; status: 'VERIFIED' }> {
    return this.http.post<{ email: string; status: 'VERIFIED' }>(
      `${this.baseUrl}/token/${token}/verify`,
      {},
    );
  }
}
