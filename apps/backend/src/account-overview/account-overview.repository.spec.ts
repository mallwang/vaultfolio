import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { ValidatedAccount } from '@vaultfolio/domain-accounts';
import { DatabaseService } from '../database/database.service';
import { AccountOverviewRepository } from './account-overview.repository';

/**
 * Insert/find/update/delete round-trips and owner-scoping (research.md #3),
 * mirroring `holdings.repository.spec.ts`.
 */
describe('AccountOverviewRepository', () => {
  let database: DatabaseService;
  let repository: AccountOverviewRepository;
  let tempDir: string;
  const ownerId = 'test-owner-id';
  const otherOwnerId = 'test-owner-id-2';

  beforeAll(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vaultfolio-account-overview-repo-'));
    process.env.DATABASE_PATH = path.join(tempDir, 'test.db');
    process.env.BOOTSTRAP_ADMIN_EMAIL = 'admin@example.com';
    process.env.BOOTSTRAP_ADMIN_PASSWORD = 'a-valid-8-char-password';

    database = new DatabaseService();
    await database.onModuleInit();
    await database.query(
      `INSERT INTO users (id, email, display_name, password_hash, role) VALUES ($1, 'owner@example.com', 'Owner', 'x', 'MEMBER')`,
      [ownerId],
    );
    await database.query(
      `INSERT INTO users (id, email, display_name, password_hash, role) VALUES ($1, 'owner2@example.com', 'Owner Two', 'x', 'MEMBER')`,
      [otherOwnerId],
    );
    repository = new AccountOverviewRepository(database);
  });

  afterAll(async () => {
    await database.onModuleDestroy();
    fs.rmSync(tempDir, { recursive: true, force: true });
    delete process.env.DATABASE_PATH;
    delete process.env.BOOTSTRAP_ADMIN_EMAIL;
    delete process.env.BOOTSTRAP_ADMIN_PASSWORD;
  });

  const validAccount: ValidatedAccount = {
    name: 'N26 checking',
    category: 'GENERAL',
    status: 'ACTIVE',
    provider: 'N26',
    website: 'https://n26.com',
    purpose: 'Everyday spending',
    cardUsage: null,
    requiredMinimum: null,
    notes: null,
    cardNumber: null,
    validUntil: null,
  };

  it('inserts and finds an account by id for its owner', async () => {
    const inserted = await repository.insert(validAccount, ownerId);
    expect(inserted.id).toBeTruthy();
    expect(inserted.name).toBe('N26 checking');

    const found = await repository.findByIdForOwner(inserted.id, ownerId);
    expect(found).not.toBeNull();
    expect(found?.name).toBe('N26 checking');
    expect(found?.category).toBe('GENERAL');
  });

  it('lists every account for the owner, ordered by created_at ASC', async () => {
    const first = await repository.insert({ ...validAccount, name: 'First' }, ownerId);
    const second = await repository.insert({ ...validAccount, name: 'Second' }, ownerId);

    const list = await repository.findAllByOwner(ownerId);
    const ids = list.map((account) => account.id);
    expect(ids.indexOf(first.id)).toBeLessThan(ids.indexOf(second.id));
  });

  it('updates an existing account for its owner', async () => {
    const inserted = await repository.insert(validAccount, ownerId);

    const updated = await repository.updateForOwner(inserted.id, ownerId, {
      ...validAccount,
      name: 'Renamed',
      category: 'SAVINGS',
    });

    expect(updated?.name).toBe('Renamed');
    expect(updated?.category).toBe('SAVINGS');
  });

  it('persists and updates the credit-card fields (cardNumber/validUntil)', async () => {
    const inserted = await repository.insert(
      {
        ...validAccount,
        category: 'CREDIT_CARD',
        cardNumber: '4111 1111 1111 1111',
        validUntil: '09/28',
      },
      ownerId,
    );
    expect(inserted.cardNumber).toBe('4111 1111 1111 1111');
    expect(inserted.validUntil).toBe('09/28');

    const updated = await repository.updateForOwner(inserted.id, ownerId, {
      ...validAccount,
      category: 'CREDIT_CARD',
      cardNumber: '5500 0000 0000 0004',
      validUntil: '01/30',
    });
    expect(updated?.cardNumber).toBe('5500 0000 0000 0004');
    expect(updated?.validUntil).toBe('01/30');
  });

  it('persists and updates status (ACTIVE/DECOMMISSIONED)', async () => {
    const inserted = await repository.insert(validAccount, ownerId);
    expect(inserted.status).toBe('ACTIVE');

    const updated = await repository.updateForOwner(inserted.id, ownerId, {
      ...validAccount,
      status: 'DECOMMISSIONED',
    });
    expect(updated?.status).toBe('DECOMMISSIONED');
  });

  it('deletes an existing account for its owner', async () => {
    const inserted = await repository.insert(validAccount, ownerId);

    const deleted = await repository.deleteForOwner(inserted.id, ownerId);
    expect(deleted).toBe(true);

    const found = await repository.findByIdForOwner(inserted.id, ownerId);
    expect(found).toBeNull();
  });

  it('reports false when deleting a nonexistent id', async () => {
    const deleted = await repository.deleteForOwner('does-not-exist', ownerId);
    expect(deleted).toBe(false);
  });

  it('a row for a different owner is invisible (owner-scoping fails closed)', async () => {
    const inserted = await repository.insert(validAccount, ownerId);

    const foundByOther = await repository.findByIdForOwner(inserted.id, otherOwnerId);
    expect(foundByOther).toBeNull();

    const listByOther = await repository.findAllByOwner(otherOwnerId);
    expect(listByOther.some((account) => account.id === inserted.id)).toBe(false);

    const updatedByOther = await repository.updateForOwner(inserted.id, otherOwnerId, {
      ...validAccount,
      name: 'Hijacked',
    });
    expect(updatedByOther).toBeNull();

    const deletedByOther = await repository.deleteForOwner(inserted.id, otherOwnerId);
    expect(deletedByOther).toBe(false);
  });
});
