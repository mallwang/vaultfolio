import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { UserRole } from '@vaultfolio/api-contract';
import { AccessDeniedException } from '@vaultfolio/observability';
import { DomainMaintenanceException } from '../maintenance/maintenance.exceptions';
import type { MaintenanceService } from '../maintenance/maintenance.service';
import { DomainGuard } from './domain.guard';

function build(domain: string | undefined, inMaintenance: boolean) {
  const reflector = { getAllAndOverride: jest.fn(() => domain) } as unknown as Reflector;
  const maintenance = {
    isInMaintenance: jest.fn(() => inMaintenance),
  } as unknown as MaintenanceService;
  const context = (user?: object) =>
    ({
      getHandler: () => undefined,
      getClass: () => undefined,
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
    }) as unknown as ExecutionContext;
  return { guard: new DomainGuard(reflector, maintenance), context, maintenance };
}

const member = (scopes: string[]) => ({ role: UserRole.MEMBER, domainScopes: scopes });
const admin = { role: UserRole.ADMIN, domainScopes: [] };

describe('DomainGuard', () => {
  it('passes routes without @RequiresDomain', () => {
    const { guard, context } = build(undefined, true);
    expect(guard.canActivate(context(member([])))).toBe(true);
  });

  it('passes an entitled member while the domain is active', () => {
    const { guard, context } = build('insurances', false);
    expect(guard.canActivate(context(member(['insurances'])))).toBe(true);
  });

  it('answers 403 for a non-entitled caller even during maintenance (403 before 503)', () => {
    const { guard, context } = build('insurances', true);
    expect(() => guard.canActivate(context(member(['holdings'])))).toThrow(AccessDeniedException);
    expect(() => guard.canActivate(context(undefined))).toThrow(AccessDeniedException);
  });

  it('answers 503 for an entitled member during maintenance', () => {
    const { guard, context, maintenance } = build('insurances', true);
    const act = () => guard.canActivate(context(member(['insurances'])));
    expect(act).toThrow(DomainMaintenanceException);
    try {
      act();
    } catch (error) {
      expect((error as DomainMaintenanceException).getStatus()).toBe(503);
      expect((error as DomainMaintenanceException).getResponse()).toMatchObject({
        error: 'DOMAIN_MAINTENANCE',
      });
    }
    expect(maintenance.isInMaintenance).toHaveBeenCalledWith('insurances');
  });

  it('lets an admin through during maintenance', () => {
    const { guard, context } = build('insurances', true);
    expect(guard.canActivate(context(admin))).toBe(true);
  });
});
