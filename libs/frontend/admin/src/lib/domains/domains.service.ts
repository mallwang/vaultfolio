import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import type {
  DomainMaintenanceAdminResponse,
  DomainMaintenanceStatus,
  SetDomainMaintenanceRequest,
} from '@vaultfolio/api-contract';

/** `HttpClient` wrapper for `/api/admin/domains` (041-domain-maintenance-mode); ADMIN only. */
@Injectable({ providedIn: 'root' })
export class DomainsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/admin/domains';

  list(): Observable<DomainMaintenanceAdminResponse> {
    return this.http.get<DomainMaintenanceAdminResponse>(this.baseUrl);
  }

  setMaintenance(domainId: string, inMaintenance: boolean): Observable<DomainMaintenanceStatus> {
    const body: SetDomainMaintenanceRequest = { inMaintenance };
    return this.http.put<DomainMaintenanceStatus>(`${this.baseUrl}/${domainId}`, body);
  }
}
