import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import type { SessionUser, SignInRequest } from '@vaultfolio/api-contract';

/**
 * `HttpClient` wrapper for `/api/auth/*` (contracts/auth-api.md). The
 * session id itself is an httpOnly cookie the browser sends automatically —
 * this service never reads or stores it (research.md #8).
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/auth';

  signIn(body: SignInRequest): Observable<SessionUser> {
    return this.http.post<SessionUser>(`${this.baseUrl}/sign-in`, body);
  }

  signOut(): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/sign-out`, {});
  }

  getSession(): Observable<SessionUser> {
    return this.http.get<SessionUser>(`${this.baseUrl}/session`);
  }
}
