import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { Logger } from '@nestjs/common';
import { UsersRepository } from '../auth/users.repository';
import { DatabaseService } from '../database/database.service';
import { RequestsRepository } from './requests.repository';
import { RequestsRetentionService } from './requests-retention.service';

const DAY = 24 * 60 * 60 * 1000;
const T0 = new Date('2026-10-01T10:00:00.000Z');
const at = (days: number) => new Date(T0.getTime() + days * DAY);

describe('RequestsRetentionService', () => {
  let database: DatabaseService;
  let repository: RequestsRepository;
  let service: RequestsRetentionService;
  let tempDir: string;
  let adminId: string;
  let memberId: string;
  let now = T0;
  let logs: jest.SpyInstance;

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vaultfolio-requests-retention-'));
    process.env.DATABASE_PATH = path.join(tempDir, 'test.db');
    delete process.env.BOOTSTRAP_ADMIN_EMAIL;
    delete process.env.BOOTSTRAP_ADMIN_PASSWORD;
    database = new DatabaseService();
    await database.onModuleInit();
    repository = new RequestsRepository(database);
    const users = new UsersRepository(database);
    adminId = (
      await users.create({
        email: 'a@example.com',
        displayName: 'a',
        passwordHash: 'h',
        role: 'ADMIN',
      })
    ).id;
    memberId = (
      await users.create({
        email: 'm@example.com',
        displayName: 'm',
        passwordHash: 'h',
        role: 'MEMBER',
      })
    ).id;
    now = T0;
    service = new RequestsRetentionService(repository);
    service.now = () => now;
    logs = jest.spyOn(Logger.prototype, 'log').mockImplementation();
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await database.onModuleDestroy();
    fs.rmSync(tempDir, { recursive: true, force: true });
    delete process.env.DATABASE_PATH;
  });

  let seq = 0;
  function submit(): string {
    seq += 1;
    const id = `req-${seq}`;
    repository.insert({
      id,
      feature: 'earnings',
      type: 'new-parser',
      requesterId: memberId,
      payload: '{"schemaVersion":1,"pages":1,"lines":[],"period":null}',
      layoutFingerprint: `fp-${seq}`,
      possibleDuplicate: false,
      createdAt: T0.toISOString(),
      attachment: {
        contentType: 'application/pdf',
        bytes: Buffer.from('%PDF'),
        sha256: 'a'.repeat(64),
        pageCount: 1,
      },
    });
    return id;
  }
  const setStatus = (
    id: string,
    status: 'OPEN' | 'IN_PROGRESS' | 'DONE' | 'REJECTED',
    when: Date,
  ) => repository.update(id, { status }, adminId, when.toISOString());

  it('never purges open or in-progress requests, however old', () => {
    const open = submit();
    const progress = submit();
    setStatus(progress, 'IN_PROGRESS', at(1));
    now = at(400);
    expect(service.sweep()).toBe(0);
    for (const id of [open, progress]) {
      expect(repository.findById(id)?.attachment).not.toBeNull();
      expect(repository.findById(id)?.payload).not.toBeNull();
    }
  });

  it.each(['DONE', 'REJECTED'] as const)(
    'keeps a %s sample for 29 days and purges it at 30 days, leaving row and status',
    (status) => {
      const id = submit();
      setStatus(id, status, T0);
      now = at(29);
      expect(service.sweep()).toBe(0);
      expect(repository.findById(id)?.attachment).not.toBeNull();

      now = at(30);
      expect(service.sweep()).toBe(1);
      const purged = repository.findById(id);
      expect(purged?.attachment).toBeNull();
      expect(purged?.payload).toBeNull();
      expect(purged?.payloadPurgedAt).toBe(at(30).toISOString());
      expect(purged?.status).toBe(status);
      expect(repository.findAttachmentContent(id)).toBeNull();
    },
  );

  it('cancels the countdown when a request is reopened', () => {
    const id = submit();
    setStatus(id, 'DONE', T0);
    now = at(10);
    setStatus(id, 'OPEN', now);
    expect(repository.findById(id)?.closedAt).toBeNull();
    now = at(60);
    expect(service.sweep()).toBe(0);
    expect(repository.findById(id)?.attachment).not.toBeNull();

    setStatus(id, 'REJECTED', now);
    now = at(89);
    expect(service.sweep()).toBe(0);
    now = at(90);
    expect(service.sweep()).toBe(1);
  });

  it('is idempotent and logs one content-free line per sweep that purged something', () => {
    const id = submit();
    setStatus(id, 'DONE', T0);
    now = at(31);
    expect(service.sweep()).toBe(1);
    expect(service.sweep()).toBe(0);
    expect(logs).toHaveBeenCalledTimes(1);
    expect(logs.mock.calls[0][0]).toEqual({ event: 'RequestSamplesPurged', count: 1 });
  });

  it('honours an injected retention period', () => {
    const id = submit();
    setStatus(id, 'DONE', T0);
    service.retentionDays = 7;
    now = at(7);
    expect(service.sweep()).toBe(1);
    expect(repository.findById(id)?.attachment).toBeNull();
  });
});
