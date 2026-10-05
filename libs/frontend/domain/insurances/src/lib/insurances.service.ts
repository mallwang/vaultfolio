import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { type Observable, catchError, tap, throwError } from 'rxjs';
import {
  INSURANCES_ERROR,
  type ErrorResponseDetail,
  type InsuranceContract,
  type InsuranceContractInput,
  type InsuranceSettings,
  type InsurancesData,
} from '@vaultfolio/api-contract';

/** What the UI needs from a failed insurances call. */
export interface InsurancesApiError {
  status: number;
  code: string;
  details: ErrorResponseDetail[];
}

/** Normalizes any thrown value into an {@link InsurancesApiError} (status `0` for non-HTTP errors). */
export function insurancesErrorOf(error: unknown): InsurancesApiError {
  if (error instanceof HttpErrorResponse) {
    const body = (error.error ?? {}) as { error?: string; details?: ErrorResponseDetail[] };
    return { status: error.status, code: body.error ?? 'generic', details: body.details ?? [] };
  }
  return { status: 0, code: 'generic', details: [] };
}

/**
 * `HttpClient` wrapper for every `/insurances/*` route (contracts/insurances-api.md). A
 * `503 INSURANCES_UNAVAILABLE` from any call flips `unavailable`, which the area uses to show the
 * key-unavailable state instead of any figure. Every successful write bumps `changes`.
 */
@Injectable({ providedIn: 'root' })
export class InsurancesService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/insurances';
  private readonly _unavailable = signal(false);
  private readonly _changes = signal(0);
  readonly unavailable = this._unavailable.asReadonly();
  /** Counts successful writes. */
  readonly changes = this._changes.asReadonly();

  data(): Observable<InsurancesData> {
    return this.watch(this.http.get<InsurancesData>(this.baseUrl));
  }

  create(input: InsuranceContractInput): Observable<InsuranceContract> {
    return this.write(this.http.post<InsuranceContract>(`${this.baseUrl}/contracts`, input));
  }

  update(id: string, input: InsuranceContractInput): Observable<InsuranceContract> {
    return this.write(
      this.http.put<InsuranceContract>(
        `${this.baseUrl}/contracts/${encodeURIComponent(id)}`,
        input,
      ),
    );
  }

  delete(id: string): Observable<void> {
    return this.write(
      this.http.delete<void>(`${this.baseUrl}/contracts/${encodeURIComponent(id)}`),
    );
  }

  saveSettings(settings: InsuranceSettings): Observable<InsuranceSettings> {
    return this.write(this.http.put<InsuranceSettings>(`${this.baseUrl}/settings`, settings));
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
        if (insurancesErrorOf(error).code === INSURANCES_ERROR.unavailable) {
          this._unavailable.set(true);
        }
        return throwError(() => error);
      }),
    );
  }
}
