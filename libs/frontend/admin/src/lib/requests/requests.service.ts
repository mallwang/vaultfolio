import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { type Observable, tap } from 'rxjs';
import type {
  RequestDetail,
  RequestListResponse,
  RequestStatusDto,
  UpdateRequestBody,
} from '@vaultfolio/api-contract';

/**
 * `HttpClient` wrapper for the administrator side of `/api/requests` (033,
 * contracts/requests-api.md). `openCount` mirrors the last server-reported number of open
 * requests so the Administration tab badge and the table stay in step.
 */
@Injectable({ providedIn: 'root' })
export class RequestsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/requests';

  private readonly _openCount = signal(0);
  readonly openCount = this._openCount.asReadonly();

  list(statuses: readonly RequestStatusDto[] = []): Observable<RequestListResponse> {
    let params = new HttpParams();
    for (const status of statuses) params = params.append('status', status);
    return this.http
      .get<RequestListResponse>(this.baseUrl, { params })
      .pipe(tap((response) => this._openCount.set(response.openCount)));
  }

  get(id: string): Observable<RequestDetail> {
    return this.http.get<RequestDetail>(`${this.baseUrl}/${id}`);
  }

  update(id: string, body: UpdateRequestBody): Observable<RequestDetail> {
    return this.http.patch<RequestDetail>(`${this.baseUrl}/${id}`, body);
  }

  /** The sample as a Blob; saved as a file by the caller, never displayed inline. */
  downloadAttachment(id: string): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/${id}/attachment`, { responseType: 'blob' });
  }

  /** Refreshes only the badge number. */
  refreshOpenCount(): void {
    this.list(['OPEN']).subscribe({ error: () => undefined });
  }
}
