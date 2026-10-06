import { UserRole } from '@vaultfolio/api-contract';
import { ROLES_KEY } from '../auth/roles.decorator';
import { EncryptionAdminController } from './encryption-admin.controller';
import { EncryptionDomainNotFoundException } from './encryption.exceptions';
import type { RotationService } from './rotation.service';

const USER = { id: 'u1', role: UserRole.ADMIN, domainScopes: [] };
const ACTOR = { userId: 'u1', email: 'a@example.com' };

function build() {
  const rotation = {
    status: jest.fn(() => [{ domain: 'wealth' }]),
    history: jest.fn(() => [{ id: 'r1' }]),
    actorFor: jest.fn(() => ACTOR),
    rotateMasterKey: jest.fn(() => ({ id: 'run' })),
    startReencryption: jest.fn(() => ({ id: 'run' })),
    destroyDataKey: jest.fn(() => ({ id: 'run' })),
  };
  return {
    rotation,
    controller: new EncryptionAdminController(rotation as unknown as RotationService),
  };
}

describe('EncryptionAdminController', () => {
  it('is restricted to administrators', () => {
    expect(Reflect.getMetadata(ROLES_KEY, EncryptionAdminController)).toEqual([UserRole.ADMIN]);
  });

  it('returns the status of all domains', () => {
    const { controller } = build();
    expect(controller.status()).toEqual({ domains: [{ domain: 'wealth' }] });
  });

  it.each([
    [undefined, undefined, undefined, 50],
    ['wealth', '10', 'wealth', 10],
    [undefined, '0', undefined, 1],
    [undefined, '9999', undefined, 200],
    [undefined, 'abc', undefined, 50],
  ])('history(domain=%s, limit=%s) -> filter %s, limit %s', (domain, limit, filter, bound) => {
    const { controller, rotation } = build();
    expect(controller.history(domain, limit)).toEqual({ runs: [{ id: 'r1' }] });
    expect(rotation.history).toHaveBeenCalledWith(filter, bound);
  });

  it('rejects an unknown domain with 404', () => {
    const { controller } = build();
    expect(() => controller.history('nope')).toThrow(EncryptionDomainNotFoundException);
    expect(() => controller.rotateMasterKey(USER, 'nope')).toThrow(
      EncryptionDomainNotFoundException,
    );
  });

  it('delegates the rotation routes with the acting admin', () => {
    const { controller, rotation } = build();
    controller.rotateMasterKey(USER, 'wealth');
    expect(rotation.rotateMasterKey).toHaveBeenCalledWith('wealth', ACTOR);
    controller.startReencryption(USER, 'wealth', { confirm: 'wealth' });
    expect(rotation.startReencryption).toHaveBeenCalledWith('wealth', 'wealth', ACTOR);
    controller.startReencryption(USER, 'wealth', undefined);
    expect(rotation.startReencryption).toHaveBeenLastCalledWith('wealth', '', ACTOR);
    controller.startReencryption(USER, 'wealth', { confirm: 5 });
    expect(rotation.startReencryption).toHaveBeenLastCalledWith('wealth', '', ACTOR);
    controller.destroyDataKey(USER, 'wealth', '2');
    expect(rotation.destroyDataKey).toHaveBeenCalledWith('wealth', 2, ACTOR);
  });

  it.each(['1', '0', 'x', '2.5'])('rejects destroy version %s with 404', (version) => {
    const { controller } = build();
    expect(() => controller.destroyDataKey(USER, 'wealth', version)).toThrow(
      EncryptionDomainNotFoundException,
    );
  });
});
