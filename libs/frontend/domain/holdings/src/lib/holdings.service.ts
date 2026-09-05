import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import type {
  CreateHoldingRequest,
  HoldingResponse,
  UpdateHoldingRequest,
} from '@vaultfolio/api-contract';

/**
 * `HttpClient` wrapper for `/holdings` (contracts/holdings-api.md), used by
 * User Stories 1–4. Calls a relative `/api/...` path, which nginx
 * (docker/frontend.nginx.conf) proxies to the backend container — see
 * `health-status.component.ts` for the same pattern.
 */
@Injectable({ providedIn: 'root' })
export class HoldingsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/holdings';

  list(): Observable<HoldingResponse[]> {
    return this.http.get<HoldingResponse[]>(this.baseUrl);
  }

  create(body: CreateHoldingRequest): Observable<HoldingResponse> {
    return this.http.post<HoldingResponse>(this.baseUrl, body);
  }

  update(id: string, body: UpdateHoldingRequest): Observable<HoldingResponse> {
    return this.http.put<HoldingResponse>(`${this.baseUrl}/${id}`, body);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
