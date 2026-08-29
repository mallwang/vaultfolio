import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import type { AccountSummary, ChangeRoleRequest } from '@vaultfolio/api-contract';

/**
 * `HttpClient` wrapper for `/api/accounts/*` (contracts/accounts-api.md),
 * User Story 1. Same relative-`/api/...` pattern as `HoldingsService`.
 */
@Injectable({ providedIn: 'root' })
export class AccountsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/accounts';

  list(): Observable<AccountSummary[]> {
    return this.http.get<AccountSummary[]>(this.baseUrl);
  }

  changeRole(id: string, body: ChangeRoleRequest): Observable<AccountSummary> {
    return this.http.patch<AccountSummary>(`${this.baseUrl}/${id}/role`, body);
  }

  archive(id: string): Observable<AccountSummary> {
    return this.http.post<AccountSummary>(`${this.baseUrl}/${id}/archive`, {});
  }

  reactivate(id: string): Observable<AccountSummary> {
    return this.http.post<AccountSummary>(`${this.baseUrl}/${id}/reactivate`, {});
  }

  deleteSelf(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
