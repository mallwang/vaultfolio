import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { SubmitRequestBody, SubmitRequestResponse } from '@vaultfolio/api-contract';
import type { LayoutSubmissionV1 } from '@vaultfolio/earnings';
import type { Observable } from 'rxjs';

/** `POST /requests` for `earnings/new-parser` — the wizard's only network call (FR-009, SC-003). */
@Injectable({ providedIn: 'root' })
export class ParserRequestService {
  private readonly http = inject(HttpClient);

  submit(layout: LayoutSubmissionV1): Observable<SubmitRequestResponse> {
    const body: SubmitRequestBody = { feature: 'earnings', type: 'new-parser', payload: layout };
    return this.http.post<SubmitRequestResponse>('/api/requests', body);
  }
}
