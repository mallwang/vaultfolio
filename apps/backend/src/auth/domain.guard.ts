import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { UserRole } from '@vaultfolio/api-contract';
import { DOMAIN_KEY } from './domain.decorator';
import type { RequestUser } from './current-user.decorator';
import { AccessDeniedException } from '@vaultfolio/observability';
import { MaintenanceService } from '../maintenance/maintenance.service';
import { DomainMaintenanceException } from '../maintenance/maintenance.exceptions';

/**
 * `@RequiresDomain('holdings')` check against `request.user.domainScopes`
 * (set by `AuthGuard`, which runs first) — the server-side counterpart of
 * the frontend's `domainGuard`/`isDomainEntitled`. An `ADMIN` always
 * passes, regardless of `domainScopes`, matching `isDomainEntitled`.
 *
 * 041: after the entitlement check, a domain in maintenance rejects non-admin callers with 503
 * (403 stays first so non-entitled callers learn nothing about maintenance).
 */
@Injectable()
export class DomainGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly maintenance: MaintenanceService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredDomain = this.reflector.getAllAndOverride<string | undefined>(DOMAIN_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredDomain) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request & { user?: RequestUser }>();
    const user = request.user;
    if (user?.role === UserRole.ADMIN) {
      return true;
    }
    if (user?.domainScopes.includes(requiredDomain)) {
      if (this.maintenance.isInMaintenance(requiredDomain)) {
        throw new DomainMaintenanceException();
      }
      return true;
    }

    throw new AccessDeniedException({
      error: 'forbidden',
      message: 'You do not have access to this resource.',
    });
  }
}
