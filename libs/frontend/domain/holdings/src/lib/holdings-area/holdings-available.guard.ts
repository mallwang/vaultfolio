import { HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router, type UrlTree } from '@angular/router';
import { catchError, firstValueFrom, map, of } from 'rxjs';
import { HoldingsService } from '../holdings.service';

/**
 * Blocks the list while the server cannot decrypt holdings data: probes `GET /holdings`
 * and sends the visitor to the unguarded `/app/holdings/unavailable` child (no redirect loop). Any other error
 * lets the screen open; its own calls report it.
 */
export const holdingsAvailableGuard = (): Promise<boolean | UrlTree> => {
  const router = inject(Router);
  return firstValueFrom(
    inject(HoldingsService)
      .list()
      .pipe(
        map((): boolean | UrlTree => true),
        catchError((error: unknown) =>
          of(
            error instanceof HttpErrorResponse && error.status === 503
              ? router.createUrlTree(['/app/holdings/unavailable'])
              : true,
          ),
        ),
      ),
  );
};
