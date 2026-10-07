import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { randomBytes } from 'node:crypto';
import Sqlite from 'better-sqlite3';
import { DatabaseService } from '../database/database.service';
import { createTestKeyring } from '../encryption/encryption.testing';
import { RetirementCryptoService } from './retirement-crypto.service';
import { RetirementStatutoryExistsException } from './retirement.exceptions';
import { type RetirementRecordData, RetirementRepository } from './retirement.repository';

const OWNER = 'owner-a';
const OTHER = 'owner-b';

const riester = (over: Partial<RetirementRecordData> = {}): RetirementRecordData => ({
  contractType: 'RIESTER',
  origin: 'MANUAL',
  status: 'ACTIVE',
  providerLabel: 'Muster Versicherung',
  statementDate: '2026-04-01',
  payoutStart: '2050-01-01',
  identifier: 'RV-123456',
  figures: { guaranteedMonthly: '100.00', expectedMonthly: '150.00' },
  ...over,
});

const statutory = (over: Partial<RetirementRecordData> = {}): RetirementRecordData => ({
  contractType: 'STATUTORY_PENSION',
  origin: 'MANUAL',
  status: 'ACTIVE',
  statementDate: '2026-05-01',
  payoutStart: '2056-03-01',
  figures: { projectedMonthly: '2000.00' },
  ...over,
});

const imported = (over: Partial<RetirementRecordData> = {}): RetirementRecordData =>
  riester({
    origin: 'IMPORTED',
    import: { parserId: 'private-statement', parserVersion: '1', ocrRead: true },
    supplement: { contributionMonthly: '30.00' },
    ...over,
  });

describe('RetirementRepository (SQLite)', () => {
  let tempDir: string;
  let dbPath: string;
  let database: DatabaseService;
  let repository: RetirementRepository;

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vaultfolio-retirement-repo-'));
    dbPath = path.join(tempDir, 'test.db');
    process.env.DATABASE_PATH = dbPath;
    process.env.ENCRYPTION_KEY = randomBytes(32).toString('base64');
    database = new DatabaseService();
    await database.onModuleInit();
    const crypto = new RetirementCryptoService(createTestKeyring(database));
    repository = new RetirementRepository(database, crypto);
  });

  afterEach(async () => {
    await database.onModuleDestroy();
    fs.rmSync(tempDir, { recursive: true, force: true });
    delete process.env.DATABASE_PATH;
    delete process.env.ENCRYPTION_KEY;
  });

  it('stores figures and identifier only as ciphertext', () => {
    const record = repository.insert(OWNER, riester());
    expect(record).toMatchObject({
      pillar: 'PRIVATE',
      contractType: 'RIESTER',
      origin: 'MANUAL',
      identifier: 'RV-123456',
      figures: { guaranteedMonthly: '100.00', expectedMonthly: '150.00' },
      supplement: null,
      import: null,
    });
    const raw = new Sqlite(dbPath, { readonly: true });
    const stored = JSON.stringify(raw.prepare('SELECT * FROM retirement_records').get());
    raw.close();
    expect(stored).not.toContain('100.00');
    expect(stored).not.toContain('RV-123456');
    expect(stored).toContain('Muster Versicherung');
  });

  it('stores import provenance and the supplement for imported records', () => {
    const record = repository.insert(OWNER, imported());
    expect(record.import).toEqual({
      parserId: 'private-statement',
      parserVersion: '1',
      ocrRead: true,
    });
    expect(record.supplement).toEqual({ contributionMonthly: '30.00' });
  });

  it('scopes every read and write to the owner', () => {
    const mine = repository.insert(OWNER, riester());
    expect(repository.get(OTHER, mine.id)).toBeNull();
    expect(repository.list(OTHER)).toEqual([]);
    expect(repository.update(OTHER, mine.id, riester({ status: 'PAID_UP' }))).toBeNull();
    expect(repository.updateSupplement(OTHER, mine.id, {})).toBeNull();
    expect(repository.delete(OTHER, mine.id)).toBe(false);
    expect(repository.deleteAll(OTHER)).toBe(0);
    expect(repository.get(OWNER, mine.id)?.status).toBe('ACTIVE');
  });

  it('lists newest statement first and filters by pillar', () => {
    const older = repository.insert(OWNER, riester({ statementDate: '2025-04-01' }));
    const newer = repository.insert(OWNER, riester({ statementDate: '2026-04-01' }));
    const drv = repository.insert(OWNER, statutory());
    expect(repository.list(OWNER).map((r) => r.id)).toEqual([drv.id, newer.id, older.id]);
    expect(repository.list(OWNER, 'PRIVATE').map((r) => r.id)).toEqual([newer.id, older.id]);
    expect(repository.list(OWNER, 'OCCUPATIONAL')).toEqual([]);
  });

  it('updates a manual record, keeping its id and creation time', () => {
    const created = repository.insert(OWNER, riester());
    const updated = repository.update(
      OWNER,
      created.id,
      riester({
        status: 'PAID_UP',
        identifier: undefined,
        figures: { guaranteedMonthly: '90.00' },
      }),
    );
    expect(updated).toMatchObject({
      id: created.id,
      createdAt: created.createdAt,
      status: 'PAID_UP',
      identifier: null,
      figures: { guaranteedMonthly: '90.00' },
    });
  });

  it('updates only the supplement and status of an imported record', () => {
    const created = repository.insert(OWNER, imported({ identifier: 'KEEP-1' }));
    const updated = repository.updateSupplement(
      OWNER,
      created.id,
      { contributionMonthly: '45.00' },
      'PAID_UP',
    );
    expect(updated).toMatchObject({
      status: 'PAID_UP',
      identifier: 'KEEP-1',
      figures: created.figures,
      supplement: { contributionMonthly: '45.00' },
    });
    expect(repository.updateSupplement(OWNER, created.id, {})?.status).toBe('PAID_UP');
  });

  it('allows one statutory record per owner', () => {
    repository.insert(OWNER, statutory());
    expect(repository.hasStatutory(OWNER)).toBe(true);
    expect(repository.hasStatutory(OTHER)).toBe(false);
    expect(() => repository.insert(OWNER, statutory())).toThrow(RetirementStatutoryExistsException);
    expect(() => repository.insert(OTHER, statutory())).not.toThrow();
  });

  it('replaces a record in one transaction', () => {
    const old = repository.insert(OWNER, statutory());
    const replacement = repository.replace(
      OWNER,
      old.id,
      statutory({
        origin: 'IMPORTED',
        import: { parserId: 'drv-renteninformation', parserVersion: '1', ocrRead: false },
      }),
    );
    expect(replacement?.origin).toBe('IMPORTED');
    expect(repository.list(OWNER).map((r) => r.id)).toEqual([replacement?.id]);
  });

  it('refuses to replace a foreign record or one of another type, changing nothing', () => {
    const mine = repository.insert(OWNER, riester());
    expect(repository.replace(OTHER, mine.id, riester())).toBeNull();
    expect(
      repository.replace(OWNER, mine.id, riester({ contractType: 'PRIVATE_PENSION_INSURANCE' })),
    ).toBeNull();
    expect(repository.replace(OWNER, 'missing', riester())).toBeNull();
    expect(repository.list(OWNER).map((r) => r.id)).toEqual([mine.id]);
  });

  it('rolls a replace back when the insert fails', () => {
    const drv = repository.insert(OWNER, statutory());
    const spy = jest.spyOn(repository, 'insert').mockImplementation(() => {
      throw new Error('boom');
    });
    expect(() => repository.replace(OWNER, drv.id, statutory())).toThrow('boom');
    spy.mockRestore();
    expect(repository.get(OWNER, drv.id)).not.toBeNull();
  });

  it('deletes one record or all of the owner’s records', () => {
    const a = repository.insert(OWNER, riester());
    repository.insert(OWNER, statutory());
    const foreign = repository.insert(OTHER, riester());
    expect(repository.delete(OWNER, a.id)).toBe(true);
    expect(repository.delete(OWNER, a.id)).toBe(false);
    expect(repository.deleteAll(OWNER)).toBe(1);
    expect(repository.list(OWNER)).toEqual([]);
    expect(repository.get(OTHER, foreign.id)).not.toBeNull();
  });

  it('enforces the table constraints', () => {
    const raw = new Sqlite(dbPath);
    const insert = (
      pillar: string,
      type: string,
      origin = 'MANUAL',
      parser: string | null = null,
    ) =>
      raw
        .prepare(
          `INSERT INTO retirement_records (id, owner_id, pillar, contract_type, origin, status,
             statement_date, parser_id, parser_version, payload_enc, created_at, updated_at)
           VALUES (lower(hex(randomblob(8))), 'o', ?, ?, ?, 'ACTIVE', '2026-01-01', ?, ?, 'x', 'n', 'n')`,
        )
        .run(pillar, type, origin, parser, parser);
    expect(() => insert('PRIVATE', 'RIESTER')).not.toThrow();
    expect(() => insert('PRIVATE', 'PENSIONSKASSE')).toThrow();
    expect(() => insert('STATUTORY', 'RIESTER')).toThrow();
    expect(() => insert('PRIVATE', 'RIESTER', 'IMPORTED')).toThrow();
    expect(() => insert('PRIVATE', 'RIESTER', 'IMPORTED', 'p')).not.toThrow();
    raw.close();
  });
});
