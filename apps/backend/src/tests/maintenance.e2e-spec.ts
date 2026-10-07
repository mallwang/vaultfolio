import { InsurancesReminderService } from '../insurances/insurances-reminder.service';
import {
  type InsurancesSessions,
  type InsurancesTestApp,
  bootInsurancesApp,
  contractPayload,
  settingsPayload,
  signInSessions,
} from './insurances-e2e.helpers';
import { client, createMember, signIn } from './earnings-e2e.helpers';

/**
 * HTTP e2e for domain maintenance (041, contracts/maintenance-api.md) against a temp SQLite file:
 * admin toggle, 503 enforcement for members, data preservation and the reminder catch-up.
 */
describe('domain maintenance', () => {
  let t: InsurancesTestApp;
  let s: InsurancesSessions;
  let holdingsMember: ReturnType<typeof client>;

  beforeAll(async () => {
    t = await bootInsurancesApp();
    s = await signInSessions(t);
    await createMember(t.database, 'holder@example.com', ['holdings', 'insurances']);
    holdingsMember = client(t.app, await signIn(t.app, 'holder@example.com'));
  }, 30_000);

  afterAll(async () => {
    await t.close();
  });

  beforeEach(async () => {
    await t.database.query('DELETE FROM domain_maintenance');
    await t.database.query('DELETE FROM domain_maintenance_audit');
    await t.database.query('DELETE FROM insurance_contracts');
    await t.database.query('DELETE FROM insurance_settings');
    await t.database.query('DELETE FROM insurance_reminder_log');
    t.mail.sent.length = 0;
  });

  const setState = (domain: string, inMaintenance: boolean) =>
    s.admin.put(`/admin/domains/${domain}`).send({ inMaintenance });
  const auditCount = async () =>
    (await t.database.query<{ n: number }>('SELECT COUNT(*) AS n FROM domain_maintenance_audit'))[0]
      .n;

  describe('admin API', () => {
    it('lists every domain as active by default', async () => {
      const response = await s.admin.get('/admin/domains');
      expect(response.status).toBe(200);
      expect(response.body.domains).toHaveLength(8);
      expect(response.body.domains[0]).toEqual({
        domainId: 'holdings',
        inMaintenance: false,
        updatedAt: null,
        updatedBy: null,
      });
    });

    it('toggles a domain, persists the state and reports the acting admin', async () => {
      const response = await setState('insurances', true);
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({ domainId: 'insurances', inMaintenance: true });
      expect(response.body.updatedBy).toEqual(expect.any(String));
      expect(response.body.updatedAt).toEqual(expect.any(String));

      const list = await s.admin.get('/admin/domains');
      expect(
        list.body.domains.find((d: { domainId: string }) => d.domainId === 'insurances'),
      ).toMatchObject({ inMaintenance: true });

      expect((await setState('insurances', false)).body.inMaintenance).toBe(false);
    });

    it('is idempotent and writes an audit row only for real changes', async () => {
      await setState('insurances', true);
      await setState('insurances', true);
      expect(await auditCount()).toBe(1);
      await setState('insurances', false);
      expect(await auditCount()).toBe(2);
      const rows = await t.database.query<{ actor_id: string; in_maintenance: number }>(
        'SELECT actor_id, in_maintenance FROM domain_maintenance_audit ORDER BY changed_at',
      );
      expect(rows.map((r) => r.in_maintenance)).toEqual([1, 0]);
      expect(rows[0].actor_id).toEqual(expect.any(String));
    });

    it('rejects a malformed body with 400 and an unknown domain with 404', async () => {
      expect((await s.admin.put('/admin/domains/insurances').send({})).status).toBe(400);
      expect(
        (await s.admin.put('/admin/domains/insurances').send({ inMaintenance: 'yes' })).status,
      ).toBe(400);
      const unknown = await setState('nope', true);
      expect(unknown.status).toBe(404);
      expect(unknown.body.error).toBe('DOMAIN_NOT_FOUND');
    });

    it('denies non-admins (403) and anonymous callers (401)', async () => {
      expect((await s.member.get('/admin/domains')).status).toBe(403);
      expect(
        (await s.member.put('/admin/domains/insurances').send({ inMaintenance: true })).status,
      ).toBe(403);
      const { default: request } = await import('supertest');
      expect((await request(t.app.getHttpServer()).get('/admin/domains')).status).toBe(401);
    });
  });

  describe('GET /domains/maintenance', () => {
    it('lets any signed-in user read the ids in maintenance', async () => {
      await setState('insurances', true);
      await setState('holdings', true);
      const response = await s.outsider.get('/domains/maintenance');
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ domains: ['holdings', 'insurances'] });
    });

    it('answers 401 without a session', async () => {
      const { default: request } = await import('supertest');
      expect((await request(t.app.getHttpServer()).get('/domains/maintenance')).status).toBe(401);
    });
  });

  describe('enforcement on domain routes', () => {
    it('rejects entitled members with 503 DOMAIN_MAINTENANCE on read and write routes', async () => {
      await setState('insurances', true);
      for (const response of [
        await s.member.get('/insurances'),
        await s.member.post('/insurances/contracts').send(contractPayload()),
        await s.member.put('/insurances/settings').send(settingsPayload()),
      ]) {
        expect(response.status).toBe(503);
        expect(response.body).toMatchObject({
          error: 'DOMAIN_MAINTENANCE',
          message: 'This area is temporarily unavailable due to maintenance.',
        });
        expect(typeof response.body.correlationId).toBe('string');
      }
    });

    it('keeps 403 before 503 for callers without the domain scope', async () => {
      await setState('insurances', true);
      expect((await s.outsider.get('/insurances')).status).toBe(403);
    });

    it('lets admins through and leaves other domains untouched', async () => {
      await setState('insurances', true);
      expect((await s.admin.get('/insurances')).status).toBe(200);
      expect((await holdingsMember.get('/holdings')).status).toBe(200);
    });

    it('serves members again once maintenance ends', async () => {
      await setState('insurances', true);
      await setState('insurances', false);
      expect((await s.member.get('/insurances')).status).toBe(200);
    });

    it('preserves stored data across a maintenance window', async () => {
      const created = await s.member.post('/insurances/contracts').send(contractPayload());
      expect(created.status).toBe(201);
      const snapshot = () =>
        t.database.query('SELECT id, payload_enc FROM insurance_contracts ORDER BY id');
      const before = await snapshot();
      await setState('insurances', true);
      await s.member.del(`/insurances/contracts/${created.body.id}`);
      await setState('insurances', false);
      expect(await snapshot()).toEqual(before);
    });
  });

  describe('insurance reminders', () => {
    const dueContract = () =>
      contractPayload({
        type: 'CAR',
        name: 'Golf',
        endDate: '2026-12-31',
        cancellation: { autoRenew: true, period: { value: 3, unit: 'MONTHS' } },
      });
    const sweep = (today: string) => t.get(InsurancesReminderService).sweep(today);

    beforeEach(async () => {
      await s.member.post('/insurances/contracts').send(dueContract());
      await s.member.put('/insurances/settings').send(settingsPayload());
    });

    it('sends nothing during maintenance and catches up exactly once afterwards', async () => {
      await setState('insurances', true);
      expect(await sweep('2026-09-10')).toBe(0);
      expect(await sweep('2026-09-11')).toBe(0);
      expect(t.mail.sent).toEqual([]);
      const log = await t.database.query('SELECT * FROM insurance_reminder_log');
      expect(log).toEqual([]);

      await setState('insurances', false);
      expect(await sweep('2026-09-12')).toBe(1);
      expect(await sweep('2026-09-13')).toBe(0);
      expect(t.mail.sent).toHaveLength(1);
    });

    it('never sends a skipped reminder after its deadline has passed', async () => {
      await setState('insurances', true);
      await sweep('2026-09-10');
      await setState('insurances', false);
      expect(await sweep('2026-10-01')).toBe(0);
      expect(t.mail.sent).toEqual([]);
    });
  });
});
