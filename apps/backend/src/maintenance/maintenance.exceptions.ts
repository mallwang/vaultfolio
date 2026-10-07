import { BusinessException, ResourceNotFoundException } from '@vaultfolio/observability';
import { DOMAIN_MAINTENANCE_ERROR } from '@vaultfolio/api-contract';

/** 503 for every route of a domain that is in maintenance (non-admin callers only). */
export class DomainMaintenanceException extends BusinessException {
  constructor() {
    super(
      {
        error: DOMAIN_MAINTENANCE_ERROR,
        message: 'This area is temporarily unavailable due to maintenance.',
      },
      503,
    );
  }
}

export class MaintenanceDomainNotFoundException extends ResourceNotFoundException {
  constructor() {
    super({ error: 'DOMAIN_NOT_FOUND', message: 'Unknown domain.' });
  }
}
