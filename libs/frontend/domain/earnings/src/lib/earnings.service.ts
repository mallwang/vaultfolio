import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { type Observable, catchError, tap, throwError } from 'rxjs';
import type {
  DataCheckRow,
  EarningsEmployer,
  EarningsImportBatch,
  EarningsImportPreview,
  EarningsImportResult,
  EarningsImportSummary,
  EarningsOverview,
  EarningsRecordDetail,
  EarningsTables,
} from '@vaultfolio/api-contract';

/**
 * `HttpClient` wrapper for every `/earnings/*` route (contracts/earnings-api.md). A
 * `503 EARNINGS_UNAVAILABLE` from any call flips `unavailable`, which the area uses to show the
 * key-unavailable state instead of any figure (FR-044).
 */
@Injectable({ providedIn: 'root' })
export class EarningsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/earnings';
  private readonly _unavailable = signal(false);
  readonly unavailable = this._unavailable.asReadonly();

  overview(employerId?: string | null): Observable<EarningsOverview> {
    return this.watch(
      this.http.get<EarningsOverview>(`${this.baseUrl}/overview`, { params: employer(employerId) }),
    );
  }

  records(period?: string): Observable<EarningsRecordDetail[]> {
    const params = period ? new HttpParams().set('period', period) : undefined;
    return this.watch(this.http.get<EarningsRecordDetail[]>(`${this.baseUrl}/records`, { params }));
  }

  tables(employerId?: string | null): Observable<EarningsTables> {
    return this.watch(
      this.http.get<EarningsTables>(`${this.baseUrl}/tables`, { params: employer(employerId) }),
    );
  }

  dataCheck(employerId?: string | null): Observable<DataCheckRow[]> {
    return this.watch(
      this.http.get<DataCheckRow[]>(`${this.baseUrl}/data-check`, { params: employer(employerId) }),
    );
  }

  imports(): Observable<EarningsImportSummary[]> {
    return this.watch(this.http.get<EarningsImportSummary[]>(`${this.baseUrl}/imports`));
  }

  preview(batch: EarningsImportBatch): Observable<EarningsImportPreview> {
    return this.watch(
      this.http.post<EarningsImportPreview>(`${this.baseUrl}/imports/preview`, batch),
    );
  }

  commit(batch: EarningsImportBatch): Observable<EarningsImportResult> {
    return this.watch(this.http.post<EarningsImportResult>(`${this.baseUrl}/imports`, batch));
  }

  deleteImport(id: string): Observable<void> {
    return this.watch(this.http.delete<void>(`${this.baseUrl}/imports/${encodeURIComponent(id)}`));
  }

  deleteAll(): Observable<void> {
    return this.watch(this.http.delete<void>(this.baseUrl));
  }

  employers(): Observable<EarningsEmployer[]> {
    return this.watch(this.http.get<EarningsEmployer[]>(`${this.baseUrl}/employers`));
  }

  renameEmployer(id: string, displayName: string): Observable<EarningsEmployer> {
    return this.watch(
      this.http.put<EarningsEmployer>(`${this.baseUrl}/employers/${encodeURIComponent(id)}`, {
        displayName,
      }),
    );
  }

  private watch<T>(request: Observable<T>): Observable<T> {
    return request.pipe(
      tap(() => this._unavailable.set(false)),
      catchError((error: unknown) => {
        if (
          error instanceof HttpErrorResponse &&
          error.status === 503 &&
          error.error?.error === 'EARNINGS_UNAVAILABLE'
        ) {
          this._unavailable.set(true);
        }
        return throwError(() => error);
      }),
    );
  }
}

function employer(id: string | null | undefined): HttpParams | undefined {
  return id ? new HttpParams().set('employer', id) : undefined;
}
