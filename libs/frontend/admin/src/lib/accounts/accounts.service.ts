import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Subject, type Observable } from 'rxjs';
import type {
  AccountSummary,
  ChangeDomainScopesRequest,
  ChangeRoleRequest,
} from '@vaultfolio/api-contract';

/**
 * `HttpClient` wrapper for `/api/accounts/*` (contracts/accounts-api.md),
 * User Story 1. Same relative-`/api/...` pattern as `HoldingsService`.
 *
 * Also doubles as the cross-tab "an account may have changed elsewhere"
 * signal: `providedIn: 'root'` makes this one instance shared by
 * `AccountsComponent` and `SignupsComponent` even though they're unrelated
 * sibling tabs, so approving a sign-up can tell the (already-instantiated,
 * already-fetched) Accounts tab to refetch without a page reload.
 */
@Injectable({ providedIn: 'root' })
export class AccountsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/accounts';
  private readonly changedSubject = new Subject<void>();

  /** Emits whenever another part of the app knows the accounts list is stale. */
  readonly changed$ = this.changedSubject.asObservable();

  /** Call after a mutation elsewhere (e.g. approving a sign-up) that adds/changes an account. */
  notifyChanged(): void {
    this.changedSubject.next();
  }

  list(): Observable<AccountSummary[]> {
    return this.http.get<AccountSummary[]>(this.baseUrl);
  }

  changeRole(id: string, body: ChangeRoleRequest): Observable<AccountSummary> {
    return this.http.patch<AccountSummary>(`${this.baseUrl}/${id}/role`, body);
  }

  updateDomainScopes(id: string, body: ChangeDomainScopesRequest): Observable<AccountSummary> {
    return this.http.patch<AccountSummary>(`${this.baseUrl}/${id}/domain-scopes`, body);
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
