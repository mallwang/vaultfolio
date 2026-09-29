import { HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router, type UrlTree } from '@angular/router';
import { catchError, firstValueFrom, map, of } from 'rxjs';
import { EarningsService } from '../earnings.service';

/**
 * Blocks the import screen while the server cannot decrypt earnings data (FR-044): probes
 * `GET /earnings/employers` and sends the visitor back to the area, which then shows the
 * unavailable state. Any other error lets the screen open; its own calls report it. Returns a
 * Promise so the app can run it behind a dynamic import of this library.
 */
export const earningsAvailableGuard = (): Promise<boolean | UrlTree> => {
  const router = inject(Router);
  return firstValueFrom(
    inject(EarningsService)
      .employers()
      .pipe(
        map((): boolean | UrlTree => true),
        catchError((error: unknown) =>
          of(
            error instanceof HttpErrorResponse && error.status === 503
              ? router.createUrlTree(['/app/earnings'])
              : true,
          ),
        ),
      ),
  );
};
