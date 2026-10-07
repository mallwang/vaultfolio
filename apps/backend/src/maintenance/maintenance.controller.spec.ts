import { UserRole } from '@vaultfolio/api-contract';
import { ValidationException } from '@vaultfolio/observability';
import { ROLES_KEY } from '../auth/roles.decorator';
import { MaintenanceAdminController } from './maintenance-admin.controller';
import { MaintenanceController } from './maintenance.controller';
import type { MaintenanceService } from './maintenance.service';

const USER = { id: 'u1', role: UserRole.ADMIN, domainScopes: [] };

function build() {
  const service = {
    listInMaintenance: jest.fn(() => ['insurances']),
    listForAdmin: jest.fn(() => [{ domainId: 'insurances' }]),
    set: jest.fn(() => ({ domainId: 'insurances', inMaintenance: true })),
  };
  return { service, service_: service as unknown as MaintenanceService };
}

describe('MaintenanceController', () => {
  it('returns the ids in maintenance and carries no role restriction', () => {
    const { service_ } = build();
    expect(new MaintenanceController(service_).list()).toEqual({ domains: ['insurances'] });
    expect(Reflect.getMetadata(ROLES_KEY, MaintenanceController)).toBeUndefined();
  });
});

describe('MaintenanceAdminController', () => {
  it('is restricted to administrators', () => {
    expect(Reflect.getMetadata(ROLES_KEY, MaintenanceAdminController)).toEqual([UserRole.ADMIN]);
  });

  it('lists the admin view', () => {
    const { service_ } = build();
    expect(new MaintenanceAdminController(service_).list()).toEqual({
      domains: [{ domainId: 'insurances' }],
    });
  });

  it('delegates set() with the acting admin', () => {
    const { service, service_ } = build();
    const controller = new MaintenanceAdminController(service_);
    expect(controller.set(USER, 'insurances', { inMaintenance: true })).toEqual({
      domainId: 'insurances',
      inMaintenance: true,
    });
    expect(service.set).toHaveBeenCalledWith('u1', 'insurances', true);
  });

  it.each([undefined, {}, { inMaintenance: 'true' }, { inMaintenance: 1 }])(
    'rejects body %p with 400',
    (body) => {
      const { service, service_ } = build();
      expect(() => new MaintenanceAdminController(service_).set(USER, 'insurances', body)).toThrow(
        ValidationException,
      );
      expect(service.set).not.toHaveBeenCalled();
    },
  );
});
