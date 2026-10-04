import { HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router, type UrlTree } from '@angular/router';
import { catchError, firstValueFrom, map, of } from 'rxjs';
import { WealthService } from '../wealth.service';

/**
 * Blocks the form screens while the server cannot decrypt wealth data: probes
 * `GET /wealth/snapshots` and sends the visitor back to the area, which then shows the
 * unavailable state. Any other error lets the screen open; its own calls report it. Returns a
 * Promise so the app can run it behind a dynamic import of this library.
 */
export const wealthAvailableGuard = (): Promise<boolean | UrlTree> => {
  const router = inject(Router);
  return firstValueFrom(
    inject(WealthService)
      .snapshots()
      .pipe(
        map((): boolean | UrlTree => true),
        catchError((error: unknown) =>
          of(
            error instanceof HttpErrorResponse && error.status === 503
              ? router.createUrlTree(['/app/historic-wealth-development'])
              : true,
          ),
        ),
      ),
  );
};
