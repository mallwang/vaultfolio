import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { type Observable, catchError, tap, throwError } from 'rxjs';
import type {
  RetirementPillar,
  RetirementRecord,
  RetirementRecordInput,
  RetirementManualRecordInput,
  RetirementSummary,
  RetirementSupplementPatch,
} from '@vaultfolio/api-contract';

/**
 * `HttpClient` wrapper for every `/retirement/*` route (contracts/retirement-api.md). A
 * `503 RETIREMENT_UNAVAILABLE` from any call flips `unavailable`, which the area uses to show the
 * key-unavailable state instead of any figure. Every successful write bumps `changes`, so views
 * that list records (tab counters, pillar lists) know when to reload.
 */
@Injectable({ providedIn: 'root' })
export class RetirementService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/retirement';
  private readonly _unavailable = signal(false);
  private readonly _changes = signal(0);
  readonly unavailable = this._unavailable.asReadonly();
  /** Counts successful writes; views reload when it changes. */
  readonly changes = this._changes.asReadonly();

  summary(): Observable<RetirementSummary> {
    return this.watch(this.http.get<RetirementSummary>(`${this.baseUrl}/summary`));
  }

  records(pillar?: RetirementPillar): Observable<RetirementRecord[]> {
    const params = pillar ? new HttpParams().set('pillar', pillar) : undefined;
    return this.watch(this.http.get<RetirementRecord[]>(`${this.baseUrl}/records`, { params }));
  }

  record(id: string): Observable<RetirementRecord> {
    return this.watch(
      this.http.get<RetirementRecord>(`${this.baseUrl}/records/${encodeURIComponent(id)}`),
    );
  }

  create(input: RetirementRecordInput): Observable<RetirementRecord> {
    return this.write(this.http.post<RetirementRecord>(`${this.baseUrl}/records`, input));
  }

  update(id: string, input: RetirementManualRecordInput): Observable<RetirementRecord> {
    return this.write(
      this.http.put<RetirementRecord>(`${this.baseUrl}/records/${encodeURIComponent(id)}`, input),
    );
  }

  updateSupplement(id: string, patch: RetirementSupplementPatch): Observable<RetirementRecord> {
    return this.write(
      this.http.patch<RetirementRecord>(
        `${this.baseUrl}/records/${encodeURIComponent(id)}/supplement`,
        patch,
      ),
    );
  }

  delete(id: string): Observable<void> {
    return this.write(this.http.delete<void>(`${this.baseUrl}/records/${encodeURIComponent(id)}`));
  }

  deleteAll(): Observable<void> {
    return this.write(this.http.delete<void>(this.baseUrl));
  }

  private write<T>(request: Observable<T>): Observable<T> {
    return this.watch(request).pipe(tap(() => this._changes.update((n) => n + 1)));
  }

  private watch<T>(request: Observable<T>): Observable<T> {
    return request.pipe(
      tap(() => this._unavailable.set(false)),
      catchError((error: unknown) => {
        if (
          error instanceof HttpErrorResponse &&
          error.status === 503 &&
          error.error?.error === 'RETIREMENT_UNAVAILABLE'
        ) {
          this._unavailable.set(true);
        }
        return throwError(() => error);
      }),
    );
  }
}
