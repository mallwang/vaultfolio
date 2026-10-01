import { inject } from '@angular/core';
import { Router, type UrlTree } from '@angular/router';
import { ParserRequestStore } from './parser-request.store';

/** The wizard only makes sense with a file handed over from the import page; a reload lands back there (FR-009). */
export function parserRequestGuard(): boolean | UrlTree {
  return (
    inject(ParserRequestStore).file() !== null ||
    inject(Router).createUrlTree(['/app/earnings/import'])
  );
}
