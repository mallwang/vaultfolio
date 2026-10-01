import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { UsersRepository } from '../auth/users.repository';
import { DatabaseService } from '../database/database.service';
import type { RequestUser } from '../auth/current-user.decorator';
import { EarningsNewParserHandler } from './handlers/earnings-new-parser.handler';
import { PLANTED, plantedLayout, validSubmission } from './requests.test-support';
import { RequestsRepository } from './requests.repository';
import { RequestsService } from './requests.service';

const BODY = (payload: unknown = validSubmission()) => ({
  feature: 'earnings',
  type: 'new-parser',
  payload,
});

describe('RequestsService — submit', () => {
  let database: DatabaseService;
  let repository: RequestsRepository;
  let service: RequestsService;
  let tempDir: string;
  let seq = 0;

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vaultfolio-requests-service-'));
    process.env.DATABASE_PATH = path.join(tempDir, 'test.db');
    delete process.env.BOOTSTRAP_ADMIN_EMAIL;
    delete process.env.BOOTSTRAP_ADMIN_PASSWORD;
    database = new DatabaseService();
    await database.onModuleInit();
    repository = new RequestsRepository(database);
    service = new RequestsService(repository, [new EarningsNewParserHandler()]);
  });

  afterEach(async () => {
    jest.useRealTimers();
    await database.onModuleDestroy();
    fs.rmSync(tempDir, { recursive: true, force: true });
    delete process.env.DATABASE_PATH;
  });

  async function user(
    role: 'ADMIN' | 'MEMBER' = 'MEMBER',
    domainScopes: string[] = ['earnings'],
  ): Promise<RequestUser> {
    seq += 1;
    const users = new UsersRepository(database);
    const created = await users.create({
      email: `user${seq}@example.com`,
      displayName: `user${seq}`,
      passwordHash: 'h',
      role,
    });
    return { id: created.id, role, domainScopes };
  }

  const reject = (call: () => unknown): { error: string; details?: unknown } => {
    try {
      call();
    } catch (error) {
      const e = error as { getResponse(): { error: string }; details?: unknown };
      return { error: e.getResponse().error, details: e.details };
    }
    throw new Error('expected a rejection');
  };

  it('stores the request and the generated attachment in one transaction', async () => {
    const member = await user();
    const response = service.submit(member, BODY());

    expect(Object.keys(response).sort()).toEqual(['id', 'possibleDuplicate', 'submittedAt']);
    expect(response.possibleDuplicate).toBe(false);
    const stored = repository.findById(response.id);
    expect(stored).toMatchObject({
      feature: 'earnings',
      type: 'new-parser',
      requesterId: member.id,
      status: 'OPEN',
      createdAt: response.submittedAt,
      payload: JSON.stringify({ schemaVersion: 1, pages: 1, lines: [], period: null }),
    });
    const content = repository.findAttachmentContent(response.id) as Buffer;
    expect(stored?.attachment).toMatchObject({
      contentType: 'application/pdf',
      sizeBytes: content.byteLength,
      pageCount: 1,
      sha256: createHash('sha256').update(content).digest('hex'),
    });
    expect(content.subarray(0, 8).toString('latin1')).toBe('%PDF-1.4');
  });

  it('never echoes submitted content and stores none of the planted values', async () => {
    const member = await user();
    const response = service.submit(member, BODY());
    expect(JSON.stringify(response)).not.toMatch(/Brutto|Lohnsteuer|\d,\d{2}/);
    const stored = (repository.findAttachmentContent(response.id) as Buffer).toString('latin1');
    for (const planted of PLANTED) expect(stored).not.toContain(planted);
    expect(repository.findById(response.id)?.payload).not.toContain('Musterfrau');
  });

  it('rejects an unknown type or feature and a malformed envelope', async () => {
    const member = await user();
    expect(reject(() => service.submit(member, { ...BODY(), type: 'nope' })).error).toBe(
      'UNKNOWN_REQUEST_TYPE',
    );
    expect(reject(() => service.submit(member, { ...BODY(), feature: 'holdings' })).error).toBe(
      'UNKNOWN_REQUEST_TYPE',
    );
    expect(reject(() => service.submit(member, null)).error).toBe('UNKNOWN_REQUEST_TYPE');
    expect(reject(() => service.submit(member, { feature: 1, type: 2 })).error).toBe(
      'UNKNOWN_REQUEST_TYPE',
    );
    expect(reject(() => service.submit(member, { ...BODY(), extra: true })).error).toBe(
      'LAYOUT_UNKNOWN_FIELD',
    );
    expect(repository.list()).toEqual([]);
  });

  it('requires the type’s domain; administrators always pass', async () => {
    const withoutDomain = await user('MEMBER', ['holdings']);
    expect(reject(() => service.submit(withoutDomain, BODY())).error).toBe('forbidden');
    const admin = await user('ADMIN', []);
    expect(() => service.submit(admin, BODY())).not.toThrow();
    expect(repository.list()).toHaveLength(1);
  });

  it('allows three open requests and rejects the fourth with REQUEST_LIMIT_OPEN', async () => {
    const member = await user();
    for (let i = 0; i < 3; i += 1) service.submit(member, BODY(validSubmission(i + 1)));
    expect(reject(() => service.submit(member, BODY())).error).toBe('REQUEST_LIMIT_OPEN');
    expect(repository.list()).toHaveLength(3);
    // another user is unaffected
    const other = await user();
    expect(() => service.submit(other, BODY())).not.toThrow();
  });

  it('counts IN_PROGRESS as open and ignores closed requests for the open limit', async () => {
    const member = await user();
    const admin = await user('ADMIN', []);
    const ids = [1, 2, 3].map((i) => service.submit(member, BODY(validSubmission(i))).id);
    repository.update(ids[0], { status: 'IN_PROGRESS' }, admin.id, new Date().toISOString());
    expect(reject(() => service.submit(member, BODY())).error).toBe('REQUEST_LIMIT_OPEN');
    repository.update(ids[0], { status: 'DONE' }, admin.id, new Date().toISOString());
    expect(() => service.submit(member, BODY())).not.toThrow();
  });

  it('rejects the sixth request within 24 hours with REQUEST_LIMIT_DAILY, and allows it later', async () => {
    jest.useFakeTimers({ now: new Date('2026-10-01T10:00:00.000Z') });
    const member = await user();
    const admin = await user('ADMIN', []);
    for (let i = 0; i < 5; i += 1) {
      const { id } = service.submit(member, BODY(validSubmission(i + 1)));
      repository.update(id, { status: 'DONE' }, admin.id, new Date().toISOString());
    }
    expect(reject(() => service.submit(member, BODY())).error).toBe('REQUEST_LIMIT_DAILY');

    jest.setSystemTime(new Date('2026-10-02T10:00:01.000Z'));
    expect(() => service.submit(member, BODY())).not.toThrow();
  });

  it('checks the limits before it validates the payload', async () => {
    const member = await user();
    for (let i = 0; i < 3; i += 1) service.submit(member, BODY(validSubmission(i + 1)));
    expect(reject(() => service.submit(member, BODY({ nonsense: true }))).error).toBe(
      'REQUEST_LIMIT_OPEN',
    );
  });

  it('flags a possible duplicate of another open request with the same layout', async () => {
    const first = await user();
    const second = await user();
    const a = service.submit(first, BODY(validSubmission(1)));
    const b = service.submit(second, BODY(validSubmission(99)));
    expect(a.possibleDuplicate).toBe(false);
    expect(b.possibleDuplicate).toBe(true);
    expect(repository.findById(b.id)?.possibleDuplicate).toBe(true);
    expect(repository.findById(a.id)?.possibleDuplicate).toBe(false);
  });

  it('does not flag a different layout, nor a closed request', async () => {
    const first = await user();
    const second = await user();
    const admin = await user('ADMIN', []);
    const other = plantedLayout();
    other.pages[0].lines.pop();
    const a = service.submit(first, BODY(validSubmission(1)));
    expect(service.submit(second, BODY(validSubmission(2, other))).possibleDuplicate).toBe(false);
    repository.update(a.id, { status: 'REJECTED' }, admin.id, new Date().toISOString());
    expect(service.submit(second, BODY(validSubmission(3))).possibleDuplicate).toBe(false);
  });

  it('stores nothing when validation fails', async () => {
    const member = await user();
    const withIban = validSubmission();
    withIban.pages[0].lines[0].words.push({ text: 'DE89370400440532013000', x: 100 });
    expect(reject(() => service.submit(member, BODY(withIban))).error).toBe(
      'PERSONAL_DATA_DETECTED',
    );
    expect(reject(() => service.submit(member, BODY({ schemaVersion: 2 }))).error).toBe(
      'INVALID_LAYOUT',
    );
    expect(repository.list()).toEqual([]);
    expect(repository.countSince(member.id, '2000-01-01T00:00:00.000Z')).toBe(0);
  });
});
