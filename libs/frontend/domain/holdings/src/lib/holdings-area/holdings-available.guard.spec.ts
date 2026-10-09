import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Router, UrlTree } from '@angular/router';
import { of, throwError } from 'rxjs';
import { HoldingsService } from '../holdings.service';
import { holdingsAvailableGuard } from './holdings-available.guard';

function run(list: unknown): Promise<boolean | UrlTree> {
  TestBed.configureTestingModule({
    providers: [{ provide: HoldingsService, useValue: { list: () => list } }],
  });
  return TestBed.runInInjectionContext(() => holdingsAvailableGuard());
}

describe('holdingsAvailableGuard', () => {
  it('opens the screen when holdings are readable', async () => {
    expect(await run(of([]))).toBe(true);
  });

  it('redirects to the unavailable page on 503', async () => {
    const result = await run(throwError(() => new HttpErrorResponse({ status: 503 })));
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe(
      '/app/holdings/unavailable',
    );
  });

  it('lets the screen open on any other error', async () => {
    expect(await run(throwError(() => new HttpErrorResponse({ status: 500 })))).toBe(true);
  });
});
