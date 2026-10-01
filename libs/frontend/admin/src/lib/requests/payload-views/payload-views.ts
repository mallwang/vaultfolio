import type { Type } from '@angular/core';
import { EarningsNewParserViewComponent } from './earnings-new-parser.view';

/**
 * Admin views for the stored, type-specific payload of a request, keyed `feature/type`. A type
 * without an entry shows no payload card, so a new registry row needs no admin change (SC-010).
 */
export const PAYLOAD_VIEWS: Record<string, Type<unknown>> = {
  'earnings/new-parser': EarningsNewParserViewComponent,
};
