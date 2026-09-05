import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import type { RejectSignupRequest, SignupSummary } from '@vaultfolio/api-contract';

/**
 * `HttpClient` wrapper for the admin-facing `/api/signups*` routes
 * (contracts/signups-api.md), User Story 2. Same relative-`/api/...`
 * pattern as `InvitationsService`.
 */
@Injectable({ providedIn: 'root' })
export class SignupsAdminService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/signups';

  list(): Observable<SignupSummary[]> {
    return this.http.get<SignupSummary[]>(this.baseUrl);
  }

  approve(id: string): Observable<SignupSummary> {
    return this.http.post<SignupSummary>(`${this.baseUrl}/${id}/approve`, {});
  }

  reject(id: string, body: RejectSignupRequest = {}): Observable<SignupSummary> {
    return this.http.post<SignupSummary>(`${this.baseUrl}/${id}/reject`, body);
  }

  delete(id: string): Observable<{ deleted: true }> {
    return this.http.delete<{ deleted: true }>(`${this.baseUrl}/${id}`);
  }
}
