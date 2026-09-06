import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import type {
  AccountOverviewEntry,
  CreateAccountOverviewEntryRequest,
  UpdateAccountOverviewEntryRequest,
} from '@vaultfolio/api-contract';

/**
 * `HttpClient` wrapper for `/account-overview/accounts` (contracts/
 * account-overview-api.md), mirroring `HoldingsService`'s shape. Calls a
 * relative `/api/...` path, which nginx (docker/frontend.nginx.conf) proxies
 * to the backend container.
 */
@Injectable({ providedIn: 'root' })
export class AccountOverviewService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/account-overview/accounts';

  list(): Observable<AccountOverviewEntry[]> {
    return this.http.get<AccountOverviewEntry[]>(this.baseUrl);
  }

  create(body: CreateAccountOverviewEntryRequest): Observable<AccountOverviewEntry> {
    return this.http.post<AccountOverviewEntry>(this.baseUrl, body);
  }

  update(id: string, body: UpdateAccountOverviewEntryRequest): Observable<AccountOverviewEntry> {
    return this.http.put<AccountOverviewEntry>(`${this.baseUrl}/${id}`, body);
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
