import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { type Observable, catchError, tap, throwError } from 'rxjs';
import {
  WEALTH_ERROR,
  type ErrorResponseDetail,
  type WealthClassGroupAssignment,
  type WealthSettings,
  type WealthSnapshot,
  type WealthSnapshotInput,
} from '@vaultfolio/api-contract';

/** What the UI needs from a failed wealth call (`409` carries the id of the clashing snapshot). */
export interface WealthApiError {
  status: number;
  code: string;
  existingId?: string;
  details: ErrorResponseDetail[];
}

/** Normalizes any thrown value into a {@link WealthApiError} (status `0` for non-HTTP errors). */
export function wealthErrorOf(error: unknown): WealthApiError {
  if (error instanceof HttpErrorResponse) {
    const body = (error.error ?? {}) as {
      error?: string;
      existingId?: string;
      details?: ErrorResponseDetail[];
    };
    return {
      status: error.status,
      code: body.error ?? 'generic',
      existingId: body.existingId,
      details: body.details ?? [],
    };
  }
  return { status: 0, code: 'generic', details: [] };
}

/**
 * `HttpClient` wrapper for every `/wealth/*` route (contracts/wealth-api.md). A
 * `503 WEALTH_UNAVAILABLE` from any call flips `unavailable`, which the area uses to show the
 * key-unavailable state instead of any figure. Every successful write bumps `changes`, so views
 * that show snapshots know when to reload.
 */
@Injectable({ providedIn: 'root' })
export class WealthService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/wealth';
  private readonly _unavailable = signal(false);
  private readonly _changes = signal(0);
  readonly unavailable = this._unavailable.asReadonly();
  /** Counts successful writes; views reload when it changes. */
  readonly changes = this._changes.asReadonly();

  snapshots(): Observable<WealthSnapshot[]> {
    return this.watch(this.http.get<WealthSnapshot[]>(`${this.baseUrl}/snapshots`));
  }

  snapshot(id: string): Observable<WealthSnapshot> {
    return this.watch(
      this.http.get<WealthSnapshot>(`${this.baseUrl}/snapshots/${encodeURIComponent(id)}`),
    );
  }

  create(input: WealthSnapshotInput): Observable<WealthSnapshot> {
    return this.write(this.http.post<WealthSnapshot>(`${this.baseUrl}/snapshots`, input));
  }

  update(id: string, input: WealthSnapshotInput): Observable<WealthSnapshot> {
    return this.write(
      this.http.put<WealthSnapshot>(`${this.baseUrl}/snapshots/${encodeURIComponent(id)}`, input),
    );
  }

  delete(id: string): Observable<void> {
    return this.write(
      this.http.delete<void>(`${this.baseUrl}/snapshots/${encodeURIComponent(id)}`),
    );
  }

  settings(): Observable<WealthSettings> {
    return this.watch(this.http.get<WealthSettings>(`${this.baseUrl}/settings`));
  }

  upsertClassGroup(assignment: WealthClassGroupAssignment): Observable<WealthSettings> {
    return this.write(
      this.http.put<WealthSettings>(`${this.baseUrl}/settings/class-groups`, assignment),
    );
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
        if (wealthErrorOf(error).code === WEALTH_ERROR.unavailable) {
          this._unavailable.set(true);
        }
        return throwError(() => error);
      }),
    );
  }
}
