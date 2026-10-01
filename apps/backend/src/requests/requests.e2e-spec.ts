import request from 'supertest';
import {
  ADMIN_EMAIL,
  bootEarningsApp,
  client,
  createMember,
  type EarningsTestApp,
  signIn,
} from '../tests/earnings-e2e.helpers';
import { PLANTED, plantedLayout, validSubmission } from './requests.test-support';
import { RequestsRetentionService } from './requests-retention.service';

/**
 * HTTP e2e for `/requests` (contracts/requests-api.md) against a temp SQLite file: real body
 * parsers, guards, serialization. All documents are synthetic with invented figures.
 */
describe('/requests — submit', () => {
  let t: EarningsTestApp;
  let member: ReturnType<typeof client>;
  let admin: ReturnType<typeof client>;
  let noScope: ReturnType<typeof client>;

  const body = (payload: unknown = validSubmission()) => ({
    feature: 'earnings',
    type: 'new-parser',
    payload,
  });

  const stored = async (): Promise<number> =>
    (await t.database.query<{ n: number }>('SELECT COUNT(*) AS n FROM requests'))[0].n;

  beforeAll(async () => {
    t = await bootEarningsApp();
    await createMember(t.database, 'member@example.com', ['earnings']);
    await createMember(t.database, 'noscope@example.com', ['holdings']);
    member = client(t.app, await signIn(t.app, 'member@example.com'));
    noScope = client(t.app, await signIn(t.app, 'noscope@example.com'));
    admin = client(t.app, await signIn(t.app, ADMIN_EMAIL));
  });

  afterAll(async () => {
    await t.close();
  });

  afterEach(async () => {
    await t.database.query('DELETE FROM requests');
    await t.database.query('DELETE FROM request_attachments');
  });

  it('answers 201 with id, time and duplicate flag and stores one OPEN request with its sample', async () => {
    const response = await member.post('/requests').send(body());
    expect(response.status).toBe(201);
    expect(Object.keys(response.body).sort()).toEqual(['id', 'possibleDuplicate', 'submittedAt']);
    expect(response.body.possibleDuplicate).toBe(false);

    const rows = await t.database.query<{ status: string; size_bytes: number; page_count: number }>(
      `SELECT r.status, a.size_bytes, a.page_count FROM requests r
       JOIN request_attachments a ON a.request_id = r.id WHERE r.id = $1`,
      [response.body.id],
    );
    expect(rows).toEqual([{ status: 'OPEN', size_bytes: expect.any(Number), page_count: 1 }]);
  });

  it('stores a PDF without executable content and without any planted original value (SC-003, SC-005)', async () => {
    const response = await member.post('/requests').send(body());
    const [row] = await t.database.query<{ content: Buffer }>(
      'SELECT content FROM request_attachments WHERE request_id = $1',
      [response.body.id],
    );
    const pdf = row.content.toString('latin1');
    for (const name of [
      '/JavaScript',
      '/JS',
      '/Launch',
      '/URI',
      '/EmbeddedFile',
      '/AcroForm',
      '/OpenAction',
      '/AA',
      '/Annots',
    ]) {
      expect(pdf).not.toContain(name);
    }
    for (const planted of PLANTED) expect(pdf).not.toContain(planted);
    expect(pdf).toContain('(Brutto) Tj');
  });

  it('rejects an unknown key in the payload (LAYOUT_UNKNOWN_FIELD) and stores nothing', async () => {
    const payload = { ...validSubmission(), producer: 'Acrobat' };
    const response = await member.post('/requests').send(body(payload));
    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ error: 'LAYOUT_UNKNOWN_FIELD' });
    expect(await stored()).toBe(0);
  });

  it('rejects a fourth page and a 61-character word with LIMIT_EXCEEDED', async () => {
    const fourPages = validSubmission();
    fourPages.pages = [1, 2, 3, 4].map(() => structuredClone(validSubmission().pages[0]));
    const tooMany = await member.post('/requests').send(body(fourPages));
    expect(tooMany.status).toBe(400);
    expect(tooMany.body).toMatchObject({ error: 'LIMIT_EXCEEDED' });

    const longWord = validSubmission();
    longWord.pages[0].lines[0].words[0].text = 'a'.repeat(61);
    const tooLong = await member.post('/requests').send(body(longWord));
    expect(tooLong.status).toBe(400);
    expect(tooLong.body).toMatchObject({ error: 'LIMIT_EXCEEDED' });
    expect(await stored()).toBe(0);
  });

  it('rejects an invalid layout with INVALID_LAYOUT and the JSON path only', async () => {
    const response = await member.post('/requests').send(body({ schemaVersion: 2, pages: [] }));
    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      error: 'INVALID_LAYOUT',
      details: [{ field: 'schemaVersion', message: 'INVALID_LAYOUT' }],
    });
  });

  it('answers 415 for a body that is not JSON', async () => {
    const response = await request(t.app.getHttpServer())
      .post('/requests')
      .set('Cookie', await signIn(t.app, 'member@example.com'))
      .set('Content-Type', 'text/plain')
      .send('hello');
    expect(response.status).toBe(415);
    expect(response.body).toMatchObject({ error: 'UNSUPPORTED_MEDIA_TYPE' });
  });

  it('answers 413 above 512 kB and keeps the 100 kB limit elsewhere', async () => {
    const big = { ...body(), padding: 'x'.repeat(513 * 1024) };
    const response = await member.post('/requests').send(big);
    expect(response.status).toBe(413);
    expect(response.body).toMatchObject({ error: 'payload_too_large' });
    expect(await stored()).toBe(0);
  });

  it('rejects a word that is a valid IBAN or an e-mail address with PERSONAL_DATA_DETECTED (kinds, never text)', async () => {
    const iban = validSubmission();
    iban.pages[0].lines[0].words.push({ text: 'DE89370400440532013000', x: 100 });
    const ibanResponse = await member.post('/requests').send(body(iban));
    expect(ibanResponse.status).toBe(400);
    expect(ibanResponse.body).toMatchObject({
      error: 'PERSONAL_DATA_DETECTED',
      details: [{ field: 'pages[0].lines[0]', message: 'BANK_ACCOUNT' }],
    });
    expect(JSON.stringify(ibanResponse.body)).not.toContain('DE89');

    const mail = validSubmission();
    mail.pages[0].lines[1].words.push({ text: 'erika.musterfrau@example.org', x: 100 });
    const mailResponse = await member.post('/requests').send(body(mail));
    expect(mailResponse.body).toMatchObject({ error: 'PERSONAL_DATA_DETECTED' });
    expect(JSON.stringify(mailResponse.body)).not.toContain('example.org');
    expect(await stored()).toBe(0);
  });

  it('rejects an unknown request type', async () => {
    const response = await member.post('/requests').send({ ...body(), type: 'nope' });
    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ error: 'UNKNOWN_REQUEST_TYPE' });
  });

  it('answers 403 without the earnings domain, 401 without a session; administrators may submit', async () => {
    const forbidden = await noScope.post('/requests').send(body());
    expect(forbidden.status).toBe(403);
    expect(forbidden.body).toMatchObject({ error: 'forbidden' });

    const anonymous = await request(t.app.getHttpServer()).post('/requests').send(body());
    expect(anonymous.status).toBe(401);

    const allowed = await admin.post('/requests').send(body());
    expect(allowed.status).toBe(201);
    expect(await stored()).toBe(1);
  });

  it('answers 429 REQUEST_LIMIT_OPEN for a fourth open request', async () => {
    for (let i = 1; i <= 3; i += 1) {
      expect((await member.post('/requests').send(body(validSubmission(i)))).status).toBe(201);
    }
    const response = await member.post('/requests').send(body(validSubmission(4)));
    expect(response.status).toBe(429);
    expect(response.body).toMatchObject({ error: 'REQUEST_LIMIT_OPEN' });
    expect(await stored()).toBe(3);
  });

  it('flags the same layout of another open request as a possible duplicate', async () => {
    const first = await member.post('/requests').send(body(validSubmission(1, plantedLayout())));
    const second = await admin.post('/requests').send(body(validSubmission(2, plantedLayout())));
    expect(first.body.possibleDuplicate).toBe(false);
    expect(second.body.possibleDuplicate).toBe(true);
  });
});

const withoutCorrelation = (body: Record<string, unknown>) => ({
  ...body,
  correlationId: undefined,
});

describe('/requests — administration', () => {
  let t: EarningsTestApp;
  let member: ReturnType<typeof client>;
  let admin: ReturnType<typeof client>;
  let requestId: string;

  const submit = async (seed = 1) =>
    (
      await member
        .post('/requests')
        .send({ feature: 'earnings', type: 'new-parser', payload: validSubmission(seed) })
    ).body.id as string;

  beforeAll(async () => {
    t = await bootEarningsApp();
    await createMember(t.database, 'member@example.com', ['earnings']);
    member = client(t.app, await signIn(t.app, 'member@example.com'));
    admin = client(t.app, await signIn(t.app, ADMIN_EMAIL));
  });

  afterAll(async () => {
    await t.close();
  });

  beforeEach(async () => {
    await t.database.query('DELETE FROM request_download_audit');
    await t.database.query('DELETE FROM requests');
    await t.database.query('DELETE FROM request_attachments');
    requestId = await submit();
  });

  it('lets an administrator list, read, patch and download', async () => {
    const list = await admin.get('/requests');
    expect(list.status).toBe(200);
    expect(list.body.openCount).toBe(1);
    expect(list.body.items[0]).toMatchObject({
      id: requestId,
      status: 'OPEN',
      requesterEmail: 'member@example.com',
      hasSample: true,
    });
    expect((await admin.get('/requests?status=DONE')).body.items).toEqual([]);

    const detail = await admin.get(`/requests/${requestId}`);
    expect(detail.status).toBe(200);
    expect(detail.body.attachment).toMatchObject({ pageCount: 1, downloadCount: 0 });

    const patched = await admin
      .patch(`/requests/${requestId}`)
      .send({ status: 'IN_PROGRESS', note: 'on it' });
    expect(patched.status).toBe(200);
    expect(patched.body).toMatchObject({ status: 'IN_PROGRESS', note: 'on it' });
    expect(patched.body.handledByEmail).toBe(ADMIN_EMAIL);
    expect((await admin.patch(`/requests/${requestId}`).send({})).status).toBe(400);

    const file = await admin.get(`/requests/${requestId}/attachment`).buffer(true);
    expect(file.status).toBe(200);
    expect(file.headers['content-type']).toContain('application/pdf');
    expect(file.headers['content-disposition']).toBe(
      `attachment; filename="request-${requestId.slice(0, 8)}-sample.pdf"`,
    );
    expect(file.headers['x-content-type-options']).toBe('nosniff');
    expect(file.headers['cache-control']).toBe('no-store');
    const audit = await t.database.query<{ n: number }>(
      'SELECT COUNT(*) AS n FROM request_download_audit WHERE request_id = $1',
      [requestId],
    );
    expect(audit[0].n).toBe(1);
  });

  it('answers 404 for an unknown id as administrator', async () => {
    const response = await admin.get('/requests/unknown');
    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({ error: 'REQUEST_NOT_FOUND' });
  });

  it('answers 403 for a member and 401 anonymously, with identical bodies for known and unknown ids (FR-032)', async () => {
    const anonymous = () => request(t.app.getHttpServer());
    for (const id of [requestId, 'unknown']) {
      const paths = [`/requests/${id}`, `/requests/${id}/attachment`];
      for (const path of paths) {
        const forbidden = await member.get(path);
        expect(forbidden.status).toBe(403);
        expect(withoutCorrelation(forbidden.body)).toEqual(
          withoutCorrelation((await member.get('/requests/other')).body),
        );
        expect((await anonymous().get(path)).status).toBe(401);
      }
      expect((await member.patch(`/requests/${id}`).send({ note: 'x' })).status).toBe(403);
    }
    expect((await member.get('/requests')).status).toBe(403);
    expect((await anonymous().get('/requests')).status).toBe(401);
    expect(
      (await t.database.query<{ n: number }>('SELECT COUNT(*) AS n FROM request_download_audit'))[0]
        .n,
    ).toBe(0);
  });

  it('lets the member submit another request but never read their own', async () => {
    const second = await submit(2);
    expect((await member.get(`/requests/${second}`)).status).toBe(403);
  });
});

describe('/requests — mails', () => {
  let t: EarningsTestApp;
  let member: ReturnType<typeof client>;
  let admin: ReturnType<typeof client>;

  const submit = (seed = 1) =>
    member
      .post('/requests')
      .send({ feature: 'earnings', type: 'new-parser', payload: validSubmission(seed) });
  const flushMail = () => new Promise((resolve) => setImmediate(resolve));

  beforeAll(async () => {
    t = await bootEarningsApp();
    await createMember(t.database, 'member@example.com', ['earnings']);
    member = client(t.app, await signIn(t.app, 'member@example.com'));
    admin = client(t.app, await signIn(t.app, ADMIN_EMAIL));
  });

  afterAll(async () => {
    await t.close();
  });

  beforeEach(async () => {
    process.env.APP_BASE_URL = 'https://vaultfolio.example.com';
    t.mail.sent.length = 0;
    await t.database.query('DELETE FROM requests');
    await t.database.query('DELETE FROM request_attachments');
  });

  it('sends one link-only alert to the admin after a submit, and nothing after a rejection', async () => {
    const rejected = await member.post('/requests').send({ feature: 'x', type: 'y', payload: {} });
    expect(rejected.status).toBe(400);
    await flushMail();
    expect(t.mail.sent).toHaveLength(0);

    const response = await submit();
    await flushMail();
    expect(t.mail.sent).toHaveLength(1);
    const [mail] = t.mail.sent;
    expect(mail.to).toBe(ADMIN_EMAIL);
    expect(mail.text).toContain(
      `https://vaultfolio.example.com/app/admin/requests?id=${response.body.id}`,
    );
    for (const planted of PLANTED) expect(mail.text + mail.html).not.toContain(planted);
  });

  it('still answers 201 and stores the request when the mail fails (FR-036)', async () => {
    t.mail.failNext = true;
    const response = await submit();
    expect(response.status).toBe(201);
    await flushMail();
    expect(t.mail.sent).toHaveLength(0);
    expect((await t.database.query<{ n: number }>('SELECT COUNT(*) AS n FROM requests'))[0].n).toBe(
      1,
    );
  });

  it('mails the requester once when the status enters DONE, and nothing for other statuses', async () => {
    const { id } = (await submit()).body;
    await flushMail();
    t.mail.sent.length = 0;

    for (const status of ['IN_PROGRESS', 'REJECTED', 'OPEN']) {
      expect((await admin.patch(`/requests/${id}`).send({ status })).status).toBe(200);
    }
    await flushMail();
    expect(t.mail.sent).toHaveLength(0);

    await admin.patch(`/requests/${id}`).send({ status: 'DONE' });
    await admin.patch(`/requests/${id}`).send({ status: 'DONE', note: 'again' });
    await flushMail();
    expect(t.mail.sent).toHaveLength(1);
    expect(t.mail.sent[0].to).toBe('member@example.com');
    expect(t.mail.sent[0].text).toContain('https://vaultfolio.example.com/app/earnings/import');
  });

  it('does not fail the PATCH when the done mail fails', async () => {
    const { id } = (await submit()).body;
    await flushMail();
    t.mail.failNext = true;
    const response = await admin.patch(`/requests/${id}`).send({ status: 'DONE' });
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('DONE');
  });
});

describe('/requests — rule draft', () => {
  let t: EarningsTestApp;
  let member: ReturnType<typeof client>;
  let admin: ReturnType<typeof client>;

  const withDraft = (ruleDraft?: unknown) => ({
    feature: 'earnings',
    type: 'new-parser',
    payload: { ...validSubmission(), ...(ruleDraft === undefined ? {} : { ruleDraft }) },
  });

  beforeAll(async () => {
    t = await bootEarningsApp();
    await createMember(t.database, 'member@example.com', ['earnings']);
    member = client(t.app, await signIn(t.app, 'member@example.com'));
    admin = client(t.app, await signIn(t.app, ADMIN_EMAIL));
  });

  afterAll(async () => {
    await t.close();
  });

  afterEach(async () => {
    await t.database.query('DELETE FROM requests');
    await t.database.query('DELETE FROM request_attachments');
  });

  it('stores the draft without any figure value and shows it to the administrator', async () => {
    const draft = {
      lines: [
        {
          page: 0,
          line: 5,
          figure: 'NET',
          deduction: false,
          column: { x0: 380, x1: 440 },
          format: 'DE_DECIMAL',
        },
      ],
      period: { page: 0, line: 4, x0: 380, x1: 440 },
    };
    const response = await member.post('/requests').send(withDraft(draft));
    expect(response.status).toBe(201);

    const detail = await admin.get(`/requests/${response.body.id}`);
    expect(detail.body.payload).toEqual({
      schemaVersion: 1,
      pages: 1,
      lines: [
        {
          page: 0,
          line: 5,
          label: expect.any(String),
          figure: 'NET',
          deduction: false,
          column: { x0: 380, x1: 440 },
          format: 'DE_DECIMAL',
        },
      ],
      period: { page: 0, line: 4, x0: 380, x1: 440 },
    });
    const [row] = await t.database.query<{ payload: string }>(
      'SELECT payload FROM requests WHERE id = $1',
      [response.body.id],
    );
    for (const planted of PLANTED) expect(row.payload).not.toContain(planted);
  });

  it('rejects an invalid draft with INVALID_RULE_DRAFT and stores nothing', async () => {
    const response = await member
      .post('/requests')
      .send(withDraft({ lines: [{ page: 0, line: 99, figure: 'NET', deduction: false }] }));
    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      error: 'INVALID_RULE_DRAFT',
      details: [{ field: 'ruleDraft.lines[0].line' }],
    });
    expect((await t.database.query<{ n: number }>('SELECT COUNT(*) AS n FROM requests'))[0].n).toBe(
      0,
    );
  });

  it('accepts a request without any markings', async () => {
    const response = await member.post('/requests').send(withDraft());
    expect(response.status).toBe(201);
    const detail = await admin.get(`/requests/${response.body.id}`);
    expect(detail.body.payload).toMatchObject({ lines: [], period: null });
  });
});

describe('/requests — retention', () => {
  let t: EarningsTestApp;
  let member: ReturnType<typeof client>;
  let admin: ReturnType<typeof client>;

  beforeAll(async () => {
    t = await bootEarningsApp();
    await createMember(t.database, 'member@example.com', ['earnings']);
    member = client(t.app, await signIn(t.app, 'member@example.com'));
    admin = client(t.app, await signIn(t.app, ADMIN_EMAIL));
  });

  afterAll(async () => {
    await t.close();
  });

  it('after the sweep the detail shows no payload or sample and the download answers 410', async () => {
    const { id } = (
      await member
        .post('/requests')
        .send({ feature: 'earnings', type: 'new-parser', payload: validSubmission() })
    ).body;
    await admin.patch(`/requests/${id}`).send({ status: 'DONE' });
    await t.database.query('UPDATE requests SET closed_at = $1 WHERE id = $2', [
      new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString(),
      id,
    ]);

    t.app.get(RequestsRetentionService).sweep();

    const detail = await admin.get(`/requests/${id}`);
    expect(detail.status).toBe(200);
    expect(detail.body).toMatchObject({
      status: 'DONE',
      payload: null,
      attachment: null,
      sampleDeleted: true,
    });
    const download = await admin.get(`/requests/${id}/attachment`);
    expect(download.status).toBe(410);
    expect(download.body).toMatchObject({ error: 'SAMPLE_DELETED' });
  });
});
