/** Domain maintenance API contract (041-domain-maintenance-mode). Mirrors the frontend domain registry ids. */
export const MAINTENANCE_DOMAIN_IDS = [
  'holdings',
  'retirement',
  'insurances',
  'haushaltsplaner',
  'historic-wealth-development',
  'account-overview',
  'klaro',
  'earnings',
] as const;
export type MaintenanceDomainId = (typeof MAINTENANCE_DOMAIN_IDS)[number];

/** `error` code of the 503 returned for a domain route while the domain is in maintenance. */
export const DOMAIN_MAINTENANCE_ERROR = 'DOMAIN_MAINTENANCE';

export interface DomainMaintenanceStatus {
  domainId: MaintenanceDomainId;
  inMaintenance: boolean;
  updatedAt: string | null;
  /** Display name of the admin who last changed the state. */
  updatedBy: string | null;
}

/** `GET /domains/maintenance` (any signed-in user): ids currently in maintenance. */
export interface DomainMaintenanceListResponse {
  domains: string[];
}

/** `GET /admin/domains` (ADMIN). */
export interface DomainMaintenanceAdminResponse {
  domains: DomainMaintenanceStatus[];
}

/** `PUT /admin/domains/:domainId` (ADMIN). */
export interface SetDomainMaintenanceRequest {
  inMaintenance: boolean;
}
