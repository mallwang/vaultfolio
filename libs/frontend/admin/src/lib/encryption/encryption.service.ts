import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import type {
  EncryptionDomainId,
  EncryptionHistoryResponse,
  EncryptionStatusResponse,
  RotationRun,
  StartReencryptionRequest,
} from '@vaultfolio/api-contract';

/** `HttpClient` wrapper for `/api/admin/encryption/*` (040-encryption-key-rotation); ADMIN only. */
@Injectable({ providedIn: 'root' })
export class EncryptionService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/admin/encryption';

  status(): Observable<EncryptionStatusResponse> {
    return this.http.get<EncryptionStatusResponse>(`${this.baseUrl}/status`);
  }

  history(domain?: EncryptionDomainId, limit = 50): Observable<EncryptionHistoryResponse> {
    let params = new HttpParams().set('limit', limit);
    if (domain) params = params.set('domain', domain);
    return this.http.get<EncryptionHistoryResponse>(`${this.baseUrl}/history`, { params });
  }

  rotateMasterKey(domain: EncryptionDomainId): Observable<RotationRun> {
    return this.http.post<RotationRun>(`${this.baseUrl}/domains/${domain}/master-key-rotation`, {});
  }

  startReencryption(domain: EncryptionDomainId, confirm: string): Observable<RotationRun> {
    const body: StartReencryptionRequest = { confirm };
    return this.http.post<RotationRun>(`${this.baseUrl}/domains/${domain}/reencryption`, body);
  }

  destroyDataKey(domain: EncryptionDomainId, version: number): Observable<RotationRun> {
    return this.http.post<RotationRun>(
      `${this.baseUrl}/domains/${domain}/data-keys/${version}/destroy`,
      {},
    );
  }
}
