import { Injectable, Logger } from '@nestjs/common';
import {
  MAINTENANCE_DOMAIN_IDS,
  type DomainMaintenanceStatus,
  type MaintenanceDomainId,
} from '@vaultfolio/api-contract';
import { MaintenanceDomainNotFoundException } from './maintenance.exceptions';
import { type MaintenanceRow, MaintenanceRepository } from './maintenance.repository';

function isMaintenanceDomain(value: string): value is MaintenanceDomainId {
  return (MAINTENANCE_DOMAIN_IDS as readonly string[]).includes(value);
}

function toStatus(
  domainId: MaintenanceDomainId,
  row?: MaintenanceRow | null,
): DomainMaintenanceStatus {
  return {
    domainId,
    inMaintenance: row?.inMaintenance ?? false,
    updatedAt: row?.updatedAt ?? null,
    updatedBy: row?.updatedBy ?? null,
  };
}

@Injectable()
export class MaintenanceService {
  private readonly logger = new Logger(MaintenanceService.name);

  constructor(private readonly repository: MaintenanceRepository) {}

  /** Read per request (no cache) so a change applies immediately. */
  isInMaintenance(domainId: string): boolean {
    return this.repository.isInMaintenance(domainId);
  }

  listInMaintenance(): string[] {
    return this.repository.listInMaintenance();
  }

  listForAdmin(): DomainMaintenanceStatus[] {
    const rows = new Map(this.repository.listAll().map((row) => [row.domainId, row]));
    return MAINTENANCE_DOMAIN_IDS.map((id) => toStatus(id, rows.get(id)));
  }

  set(actorId: string, domainId: string, inMaintenance: boolean): DomainMaintenanceStatus {
    if (!isMaintenanceDomain(domainId)) throw new MaintenanceDomainNotFoundException();
    const changed = this.repository.set(domainId, inMaintenance, actorId);
    if (changed) {
      this.logger.log({ event: 'DomainMaintenanceChanged', domainId, inMaintenance, actorId });
    }
    return toStatus(domainId, this.repository.get(domainId));
  }
}
