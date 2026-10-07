import { createTestDatabase, type TestDatabase } from '../encryption/encryption.testing';
import { MaintenanceDomainNotFoundException } from './maintenance.exceptions';
import { MaintenanceRepository } from './maintenance.repository';
import { MaintenanceService } from './maintenance.service';

describe('MaintenanceRepository and MaintenanceService', () => {
  let db: TestDatabase;
  let repository: MaintenanceRepository;
  let service: MaintenanceService;

  beforeEach(async () => {
    db = await createTestDatabase();
    repository = new MaintenanceRepository(db.database);
    service = new MaintenanceService(repository);
    db.database.querySync(
      "INSERT INTO users (id, email, display_name, password_hash, role) VALUES ('admin-1', 'a@example.com', 'Ada Admin', 'x', 'ADMIN')",
    );
  });

  afterEach(() => db.dispose());

  const auditRows = () =>
    db.database.querySync<{ domain_id: string; in_maintenance: number; actor_id: string }>(
      'SELECT domain_id, in_maintenance, actor_id FROM domain_maintenance_audit ORDER BY changed_at',
    );

  it('treats a domain without a row as active', () => {
    expect(service.isInMaintenance('insurances')).toBe(false);
    expect(service.listInMaintenance()).toEqual([]);
  });

  it('upserts the state, resolves the admin name and audits real changes only', () => {
    expect(repository.set('insurances', true, 'admin-1')).toBe(true);
    expect(repository.set('insurances', true, 'admin-1')).toBe(false);
    expect(service.isInMaintenance('insurances')).toBe(true);
    expect(service.listInMaintenance()).toEqual(['insurances']);
    expect(repository.get('insurances')).toMatchObject({
      inMaintenance: true,
      updatedBy: 'Ada Admin',
    });

    expect(repository.set('insurances', false, 'admin-1')).toBe(true);
    expect(service.isInMaintenance('insurances')).toBe(false);
    expect(auditRows().map((r) => r.in_maintenance)).toEqual([1, 0]);
  });

  it('keeps the audit row when the acting user is gone', () => {
    repository.set('holdings', true, 'deleted-user');
    expect(repository.get('holdings')?.updatedBy).toBeNull();
    expect(auditRows()[0].actor_id).toBe('deleted-user');
  });

  it('lists every maintainable domain for the admin view', () => {
    service.set('admin-1', 'earnings', true);
    const list = service.listForAdmin();
    expect(list).toHaveLength(8);
    expect(list.find((d) => d.domainId === 'earnings')).toMatchObject({
      inMaintenance: true,
      updatedBy: 'Ada Admin',
    });
    expect(list.find((d) => d.domainId === 'holdings')).toEqual({
      domainId: 'holdings',
      inMaintenance: false,
      updatedAt: null,
      updatedBy: null,
    });
  });

  it('rejects an unknown domain id and writes nothing', () => {
    expect(() => service.set('admin-1', 'nope', true)).toThrow(MaintenanceDomainNotFoundException);
    expect(repository.listAll()).toEqual([]);
    expect(auditRows()).toEqual([]);
  });
});
