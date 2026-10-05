import { HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router, type UrlTree } from '@angular/router';
import { catchError, firstValueFrom, map, of } from 'rxjs';
import { InsurancesService } from '../insurances.service';

/**
 * Blocks the form screens while the server cannot decrypt insurance data: probes `GET /insurances`
 * and sends the visitor back to the area, which then shows the unavailable state. Any other error
 * lets the screen open; its own calls report it.
 */
export const insurancesAvailableGuard = (): Promise<boolean | UrlTree> => {
  const router = inject(Router);
  return firstValueFrom(
    inject(InsurancesService)
      .data()
      .pipe(
        map((): boolean | UrlTree => true),
        catchError((error: unknown) =>
          of(
            error instanceof HttpErrorResponse && error.status === 503
              ? router.createUrlTree(['/app/insurances'])
              : true,
          ),
        ),
      ),
  );
};
