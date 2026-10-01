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
