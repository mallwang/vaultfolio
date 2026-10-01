import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { UsersRepository } from '../auth/users.repository';
import { DatabaseService } from '../database/database.service';
import { type NewRequest, RequestsRepository } from './requests.repository';

const SHA = 'a'.repeat(64);

describe('RequestsRepository', () => {
  let database: DatabaseService;
  let repository: RequestsRepository;
  let tempDir: string;
  let memberId: string;
  let otherMemberId: string;
  let adminId: string;
  let seq = 0;

  beforeAll(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vaultfolio-requests-repo-'));
    process.env.DATABASE_PATH = path.join(tempDir, 'test.db');
    delete process.env.BOOTSTRAP_ADMIN_EMAIL;
    delete process.env.BOOTSTRAP_ADMIN_PASSWORD;
    database = new DatabaseService();
    await database.onModuleInit();
    repository = new RequestsRepository(database);
    const users = new UsersRepository(database);
    const create = (email: string, role: 'ADMIN' | 'MEMBER') =>
      users.create({ email, displayName: email, passwordHash: 'h', role });
    memberId = (await create('member@example.com', 'MEMBER')).id;
    otherMemberId = (await create('other@example.com', 'MEMBER')).id;
    adminId = (await create('admin@example.com', 'ADMIN')).id;
  });

  afterAll(async () => {
    await database.onModuleDestroy();
    fs.rmSync(tempDir, { recursive: true, force: true });
    delete process.env.DATABASE_PATH;
  });

  function newRequest(overrides: Partial<NewRequest> = {}): NewRequest {
    seq += 1;
    return {
      id: `req-${seq}`,
      feature: 'earnings',
      type: 'new-parser',
      requesterId: memberId,
      payload: '{"schemaVersion":1}',
      layoutFingerprint: `fp-${seq}`,
      possibleDuplicate: false,
      createdAt: `2026-10-01T10:00:${String(seq).padStart(2, '0')}.000Z`,
      attachment: {
        contentType: 'application/pdf',
        bytes: Buffer.from('%PDF-test'),
        sha256: SHA,
        pageCount: 2,
      },
      ...overrides,
    };
  }

  it('inserts a request and its attachment in one transaction', () => {
    const input = newRequest();
    repository.insert(input);

    const stored = repository.findById(input.id);
    expect(stored).toMatchObject({
      id: input.id,
      feature: 'earnings',
      type: 'new-parser',
      requesterId: memberId,
      requesterEmail: 'member@example.com',
      status: 'OPEN',
      payload: '{"schemaVersion":1}',
      possibleDuplicate: false,
      note: null,
      handledBy: null,
      handledByEmail: null,
      handledAt: null,
      closedAt: null,
      payloadPurgedAt: null,
      attachment: { contentType: 'application/pdf', sizeBytes: 9, pageCount: 2, sha256: SHA },
    });
    expect(repository.findAttachmentContent(input.id)?.toString()).toBe('%PDF-test');
  });

  it('rolls the request back when the attachment insert fails', () => {
    const input = newRequest({
      attachment: {
        contentType: 'application/pdf',
        bytes: Buffer.from('x'),
        sha256: 'short',
        pageCount: 1,
      },
    });
    expect(() => repository.insert(input)).toThrow(/CHECK/);
    expect(repository.findById(input.id)).toBeNull();
  });

  it('returns null for an unknown id', () => {
    expect(repository.findById('missing')).toBeNull();
    expect(repository.findAttachmentContent('missing')).toBeNull();
  });

  it('lists newest first and filters by status', () => {
    const older = newRequest({ createdAt: '2026-01-01T00:00:00.000Z' });
    const newer = newRequest({ createdAt: '2026-12-31T00:00:00.000Z' });
    repository.insert(older);
    repository.insert(newer);
    repository.update(older.id, { status: 'DONE' }, adminId, '2026-12-31T01:00:00.000Z');

    const all = repository.list();
    expect(all[0].id).toBe(newer.id);
    expect(all.map((r) => r.id).indexOf(older.id)).toBeGreaterThan(0);
    expect(all[0]).toMatchObject({ requesterEmail: 'member@example.com', hasSample: true });

    const done = repository.list(['DONE']);
    expect(done.map((r) => r.id)).toContain(older.id);
    expect(done.map((r) => r.id)).not.toContain(newer.id);
    expect(repository.list(['DONE', 'REJECTED']).every((r) => r.status !== 'OPEN')).toBe(true);
  });

  it('counts open and in-progress requests regardless of other statuses', () => {
    const before = repository.openCount();
    const a = newRequest();
    const b = newRequest();
    const c = newRequest();
    [a, b, c].forEach((r) => repository.insert(r));
    repository.update(b.id, { status: 'IN_PROGRESS' }, adminId, '2026-10-02T00:00:00.000Z');
    repository.update(c.id, { status: 'REJECTED' }, adminId, '2026-10-02T00:00:00.000Z');
    expect(repository.openCount()).toBe(before + 2);
  });

  it('counts open requests and requests of the last 24 hours per requester', () => {
    const own = newRequest({ requesterId: otherMemberId, createdAt: '2027-01-01T12:00:00.000Z' });
    const old = newRequest({ requesterId: otherMemberId, createdAt: '2027-01-01T00:00:00.000Z' });
    repository.insert(own);
    repository.insert(old);
    repository.update(old.id, { status: 'DONE' }, adminId, '2027-01-01T01:00:00.000Z');

    expect(repository.countOpenByRequester(otherMemberId)).toBe(1);
    expect(repository.countSince(otherMemberId, '2026-12-31T13:00:00.000Z')).toBe(2);
    expect(repository.countSince(otherMemberId, '2027-01-01T06:00:00.000Z')).toBe(1);
    expect(repository.countOpenByRequester('nobody')).toBe(0);
  });

  it('finds an open duplicate by fingerprint, ignoring closed requests', () => {
    const open = newRequest({ layoutFingerprint: 'dup-open' });
    const closed = newRequest({ layoutFingerprint: 'dup-closed' });
    repository.insert(open);
    repository.insert(closed);
    repository.update(closed.id, { status: 'DONE' }, adminId, '2026-10-03T00:00:00.000Z');

    expect(repository.hasOpenWithFingerprint('dup-open')).toBe(true);
    expect(repository.hasOpenWithFingerprint('dup-closed')).toBe(false);
    expect(repository.hasOpenWithFingerprint('unknown')).toBe(false);
  });

  describe('update', () => {
    it('sets handled_by/handled_at on every change and closed_at on entering a closed status', () => {
      const input = newRequest();
      repository.insert(input);

      const progress = repository.update(
        input.id,
        { status: 'IN_PROGRESS', note: 'looking' },
        adminId,
        '2026-10-05T08:00:00.000Z',
      );
      expect(progress).toMatchObject({
        previousStatus: 'OPEN',
        request: {
          status: 'IN_PROGRESS',
          note: 'looking',
          handledBy: adminId,
          handledByEmail: 'admin@example.com',
          handledAt: '2026-10-05T08:00:00.000Z',
          closedAt: null,
        },
      });

      const done = repository.update(
        input.id,
        { status: 'DONE' },
        adminId,
        '2026-10-06T08:00:00.000Z',
      );
      expect(done?.request).toMatchObject({
        status: 'DONE',
        note: 'looking',
        handledAt: '2026-10-06T08:00:00.000Z',
        closedAt: '2026-10-06T08:00:00.000Z',
      });

      const rejected = repository.update(
        input.id,
        { status: 'REJECTED' },
        adminId,
        '2026-10-07T08:00:00.000Z',
      );
      expect(rejected?.request.closedAt).toBe('2026-10-06T08:00:00.000Z');

      const reopened = repository.update(
        input.id,
        { status: 'OPEN' },
        adminId,
        '2026-10-08T08:00:00.000Z',
      );
      expect(reopened?.request).toMatchObject({ status: 'OPEN', closedAt: null });
    });

    it('updates only the note when no status is given', () => {
      const input = newRequest();
      repository.insert(input);
      const result = repository.update(
        input.id,
        { note: 'only note' },
        adminId,
        '2026-10-05T08:00:00.000Z',
      );
      expect(result).toMatchObject({
        previousStatus: 'OPEN',
        request: { status: 'OPEN', note: 'only note', closedAt: null },
      });
    });

    it('returns null for an unknown id', () => {
      expect(
        repository.update('missing', { note: 'x' }, adminId, '2026-10-05T08:00:00.000Z'),
      ).toBeNull();
    });
  });

  describe('download audit', () => {
    it('records downloads and aggregates count and last time', () => {
      const input = newRequest();
      repository.insert(input);
      expect(repository.downloadStats(input.id)).toEqual({
        downloadCount: 0,
        lastDownloadedAt: null,
      });

      repository.recordDownload(input.id, adminId, '2026-10-05T08:00:00.000Z');
      repository.recordDownload(input.id, adminId, '2026-10-06T08:00:00.000Z');

      expect(repository.downloadStats(input.id)).toEqual({
        downloadCount: 2,
        lastDownloadedAt: '2026-10-06T08:00:00.000Z',
      });
      expect(repository.findById(input.id)?.attachment).toMatchObject({
        downloadCount: 2,
        lastDownloadedAt: '2026-10-06T08:00:00.000Z',
      });
    });
  });

  describe('purgeClosedBefore', () => {
    it('removes sample and payload of requests closed before the cutoff only', () => {
      const dueClosed = newRequest();
      const freshClosed = newRequest();
      const open = newRequest();
      [dueClosed, freshClosed, open].forEach((r) => repository.insert(r));
      repository.update(dueClosed.id, { status: 'DONE' }, adminId, '2026-11-01T00:00:00.000Z');
      repository.update(freshClosed.id, { status: 'DONE' }, adminId, '2026-11-20T00:00:00.000Z');

      const purged = repository.purgeClosedBefore(
        '2026-11-02T00:00:00.000Z',
        '2026-12-02T00:00:00.000Z',
      );
      expect(purged).toContain(dueClosed.id);
      expect(purged).not.toContain(freshClosed.id);
      expect(purged).not.toContain(open.id);

      expect(repository.findById(dueClosed.id)).toMatchObject({
        status: 'DONE',
        payload: null,
        payloadPurgedAt: '2026-12-02T00:00:00.000Z',
        attachment: null,
      });
      expect(repository.findAttachmentContent(dueClosed.id)).toBeNull();
      expect(repository.findById(freshClosed.id)?.attachment).not.toBeNull();
      expect(repository.findById(open.id)?.payload).not.toBeNull();

      // idempotent: a second sweep finds nothing new for the same request
      expect(
        repository.purgeClosedBefore('2026-11-02T00:00:00.000Z', '2026-12-03T00:00:00.000Z'),
      ).not.toContain(dueClosed.id);
    });
  });
});
