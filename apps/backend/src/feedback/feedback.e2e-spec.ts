import { randomUUID } from 'node:crypto';
import {
  ADMIN_EMAIL,
  bootEarningsApp,
  client,
  createMember,
  signIn,
  type EarningsTestApp,
} from '../tests/earnings-e2e.helpers';
import { FeedbackRepository } from './feedback.repository';

const SUBJECT = 'Secret-subject-xyz';
const MESSAGE = 'Secret-message-body-xyz';
const payload = (attemptId = randomUUID()) => ({
  attemptId,
  category: 'problem',
  subject: SUBJECT,
  message: MESSAGE,
  language: 'en',
});

const turnstileSecret = process.env.TURNSTILE_SECRET_KEY;

describe('/feedback', () => {
  let t: EarningsTestApp;
  let api: ReturnType<typeof client>;
  let me = '';
  let n = 0;
  const mine = (select = 'id') =>
    t.database.query(
      `SELECT ${select} FROM feedback_submissions WHERE owner_id = (SELECT id FROM users WHERE email = $1) ORDER BY created_at`,
      [me],
    );
  /** A fresh member per test keeps the rolling quota isolated. */
  const newMember = async () => {
    me = `member${++n}@example.com`;
    await createMember(t.database, me, []);
    api = client(t.app, await signIn(t.app, me));
  };

  beforeAll(async () => {
    delete process.env.TURNSTILE_SECRET_KEY; // verification off unless a test enables it
    t = await bootEarningsApp();
  });
  afterAll(async () => {
    if (turnstileSecret) process.env.TURNSTILE_SECRET_KEY = turnstileSecret;
    await t.close();
  });
  beforeEach(async () => {
    t.mail.sent.length = 0;
    await newMember();
  });

  it('mails every admin, stores only ciphertext and returns 201 with the quota', async () => {
    const body = payload();
    const res = await api.post('/feedback').send(body);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ id: body.attemptId, quota: { limit: 5, remaining: 4 } });
    expect(t.mail.sent).toHaveLength(1);
    expect(t.mail.sent[0].to).toBe(ADMIN_EMAIL);
    expect(t.mail.sent[0].text).toContain(MESSAGE);
    const rows = await mine('*');
    expect(rows).toHaveLength(1);
    expect(JSON.stringify(rows)).not.toContain('Secret-');
  });

  it('answers 400 with field details for invalid input and sends nothing', async () => {
    const res = await api.post('/feedback').send({ ...payload(), subject: '  ' });
    expect(res.status).toBe(400);
    expect(res.body.details).toEqual([{ field: 'subject', message: 'required' }]);
    expect(t.mail.sent).toHaveLength(0);
  });

  it('requires authentication', async () => {
    const res = await client(t.app, '').post('/feedback').send(payload());
    expect(res.status).toBe(401);
  });

  it('answers 502 and stores nothing when delivery fails', async () => {
    t.mail.failNext = true;
    const res = await api.post('/feedback').send(payload());
    expect(res.status).toBe(502);
    expect(res.body.error).toBe('feedback_delivery_failed');
    expect(await mine()).toHaveLength(0);
    expect((await api.get('/feedback/quota')).body.remaining).toBe(5);
  });

  it('still answers 201 when storing fails after delivery', async () => {
    const spy = jest
      .spyOn(t.app.get(FeedbackRepository), 'insert')
      .mockRejectedValueOnce(new Error('disk'));
    const res = await api.post('/feedback').send(payload());
    spy.mockRestore();
    expect(res.status).toBe(201);
    expect(t.mail.sent).toHaveLength(1);
  });

  it('repeats the same attemptId as 200 without a second mail', async () => {
    const body = payload();
    await api.post('/feedback').send(body);
    const again = await api.post('/feedback').send(body);
    expect(again.status).toBe(200);
    expect(again.body.id).toBe(body.attemptId);
    expect(t.mail.sent).toHaveLength(1);
  });

  it('enforces the limit of 5 with a 429 carrying the quota, and reports it via GET', async () => {
    for (let i = 0; i < 5; i++)
      expect((await api.post('/feedback').send(payload())).status).toBe(201);
    const res = await api.post('/feedback').send(payload());
    expect(res.status).toBe(429);
    expect(res.body).toMatchObject({ error: 'feedback_limit_reached', quota: { remaining: 0 } });
    expect(res.body.quota.resetAt).toEqual(expect.any(String));
    expect(t.mail.sent).toHaveLength(5);
    const quota = await api.get('/feedback/quota');
    expect(quota.body).toMatchObject({ limit: 5, remaining: 0 });
  });

  it('lets a row older than 24h drop out of the window', async () => {
    for (let i = 0; i < 5; i++) await api.post('/feedback').send(payload());
    await t.database.query(
      `UPDATE feedback_submissions SET created_at = $1 WHERE id = (SELECT id FROM feedback_submissions WHERE owner_id = (SELECT id FROM users WHERE email = $2) ORDER BY created_at LIMIT 1)`,
      [new Date(Date.now() - 24 * 3_600_000).toISOString(), me],
    );
    expect((await api.get('/feedback/quota')).body.remaining).toBe(1);
    expect((await api.post('/feedback').send(payload())).status).toBe(201);
  });

  it('never exceeds the limit under concurrent requests', async () => {
    await t.app.listen(0); // one shared listening server instead of 8 ephemeral ones
    const results = await Promise.all(
      Array.from({ length: 8 }, () => api.post('/feedback').send(payload())),
    );
    expect(results.filter((r) => r.status === 201)).toHaveLength(5);
    expect(results.filter((r) => r.status === 429)).toHaveLength(3);
    expect(t.mail.sent).toHaveLength(5);
  });

  it('rejects a missing Turnstile token when a secret is configured', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'test-secret';
    try {
      const res = await api.post('/feedback').send(payload());
      // TurnstileService throws ValidationException (400), not the 403 stated in the contract.
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('bot_protection_failed');
      expect(t.mail.sent).toHaveLength(0);
    } finally {
      delete process.env.TURNSTILE_SECRET_KEY;
    }
  });
});

describe('/feedback without an encryption key', () => {
  it('answers 503 on both endpoints', async () => {
    const t = await bootEarningsApp({ key: null });
    try {
      await createMember(t.database, 'm@example.com', []);
      const api = client(t.app, await signIn(t.app, 'm@example.com'));
      expect((await api.post('/feedback').send(payload())).status).toBe(503);
      expect((await api.get('/feedback/quota')).status).toBe(503);
      expect(t.mail.sent).toHaveLength(0);
    } finally {
      await t.close();
    }
  });
});
