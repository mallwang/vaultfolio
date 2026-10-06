import { Logger } from '@nestjs/common';
import type {
  EarningsImportFile,
  InsuranceContract,
  InsuranceSettings,
  InsurancesData,
} from '@vaultfolio/api-contract';
import { UsersRepository } from '../auth/users.repository';
import { InsurancesReminderService } from '../insurances/insurances-reminder.service';
import { InsurancesRepository } from '../insurances/insurances.repository';
import { balancedRecord, periods, sha } from './earnings-e2e.helpers';
import {
  type InsurancesSessions,
  type InsurancesTestApp,
  SECRET_NAME,
  SECRET_NUMBER,
  bootInsurancesApp,
  client,
  contractPayload,
  createMember,
  settingsPayload,
  signIn,
  signInSessions,
} from './insurances-e2e.helpers';

/**
 * HTTP e2e for `/insurances` (contracts/insurances-api.md) against a temp SQLite file with test
 * encryption keys. All payloads are invented.
 */
describe('/insurances', () => {
  let t: InsurancesTestApp;
  let s: InsurancesSessions;

  beforeAll(async () => {
    t = await bootInsurancesApp();
    s = await signInSessions(t);
  });

  afterAll(async () => {
    await t.close();
  });

  beforeEach(async () => {
    for (const table of [
      'insurance_contracts',
      'insurance_settings',
      'insurance_reminder_log',
      'earnings_records',
      'earnings_certificates',
      'earnings_imports',
      'earnings_employers',
    ])
      await t.database.query(`DELETE FROM ${table}`);
    t.mail.sent.length = 0;
  });

  const create = async (payload: object = contractPayload(), who = s.member) => {
    const response = await who.post('/insurances/contracts').send(payload);
    expect(response.status).toBe(201);
    return response.body as InsuranceContract;
  };
  const data = async (who = s.member) => (await who.get('/insurances')).body as InsurancesData;

  describe('access', () => {
    it('401 without a session, 403 without the domain scope', async () => {
      const { default: request } = await import('supertest');
      expect((await request(t.app.getHttpServer()).get('/insurances')).status).toBe(401);
      expect((await s.outsider.get('/insurances')).status).toBe(403);
      expect((await s.outsider.post('/insurances/contracts').send(contractPayload())).status).toBe(
        403,
      );
      expect((await s.outsider.put('/insurances/settings').send(settingsPayload())).status).toBe(
        403,
      );
    });

    it('lets entitled members and admins in', async () => {
      expect((await s.member.get('/insurances')).status).toBe(200);
      expect((await s.admin.get('/insurances')).status).toBe(200);
    });
  });

  describe('contracts', () => {
    it('starts with defaults', async () => {
      const body = await data();
      expect(body.contracts).toEqual([]);
      expect(body.linkedSocial).toEqual([]);
      expect(body.settings).toMatchObject({
        reminders: { enabled: false, leadDays: 30 },
        includeSocial: true,
      });
      expect(body.today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('creates, lists, updates and deletes a contract', async () => {
      const created = await create();
      expect(created).toMatchObject({ ...contractPayload(), id: expect.any(String) });
      expect(created).not.toHaveProperty('monthly');
      expect((await data()).contracts).toEqual([created]);

      const put = await s.member
        .put(`/insurances/contracts/${created.id}`)
        .send(contractPayload({ premium: '120.5', interval: 'MONTHLY', paymentMonth: undefined }));
      expect(put.status).toBe(200);
      expect(put.body).toMatchObject({ id: created.id, premium: '120.50', interval: 'MONTHLY' });

      expect((await s.member.del(`/insurances/contracts/${created.id}`)).status).toBe(204);
      expect((await data()).contracts).toEqual([]);
      expect((await s.member.del(`/insurances/contracts/${created.id}`)).status).toBe(404);
    });

    it('stores everything user-written only as ciphertext', async () => {
      await create();
      await s.member.put('/insurances/settings').send(settingsPayload());
      const rows = await t.database.query<Record<string, unknown>>(
        'SELECT * FROM insurance_contracts',
      );
      const settings = await t.database.query<Record<string, unknown>>(
        'SELECT * FROM insurance_settings',
      );
      const raw = JSON.stringify([rows, settings]);
      for (const secret of [
        SECRET_NAME,
        SECRET_NUMBER,
        'Beispiel Versicherung',
        '96.00',
        'EMPLOYED',
      ])
        expect(raw).not.toContain(secret);
      expect((rows[0] as { payload_enc: string }).payload_enc).toMatch(/^v2:/);
    });

    it('rejects invalid bodies naming fields, never values', async () => {
      const negative = await s.member
        .post('/insurances/contracts')
        .send(contractPayload({ premium: '-5.00' }));
      expect(negative.status).toBe(400);
      expect(negative.body.error).toBe('INSURANCES_VALIDATION');
      expect(negative.body.details).toEqual([{ field: 'premium', message: 'INVALID' }]);
      expect(JSON.stringify(negative.body)).not.toContain(SECRET_NAME);

      const dates = await s.member
        .post('/insurances/contracts')
        .send(contractPayload({ endDate: '2024-01-01' }));
      expect(dates.body.details).toEqual([{ field: 'endDate', message: 'DATE_ORDER' }]);

      const unknown = await s.member
        .post('/insurances/contracts')
        .send({ ...contractPayload(), extra: 1 });
      expect(unknown.status).toBe(400);
      expect(unknown.body.error).toBe('INSURANCES_UNKNOWN_FIELD');

      const wrongDetail = await s.member
        .post('/insurances/contracts')
        .send(contractPayload({ details: { licensePlate: 'B-X 1' } }));
      expect(wrongDetail.body.error).toBe('INSURANCES_UNKNOWN_FIELD');
    });

    it('enforces the limit of 200 contracts', async () => {
      const repository = t.get(InsurancesRepository);
      for (let i = 0; i < 200; i += 1) repository.insert(s.memberId, contractPayload());
      const response = await s.member.post('/insurances/contracts').send(contractPayload());
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('INSURANCES_LIMIT_EXCEEDED');
    });

    it('keeps owners apart: a foreign id behaves like a missing id', async () => {
      const mine = await create();
      expect((await data(s.other)).contracts).toEqual([]);
      expect(
        (await s.other.put(`/insurances/contracts/${mine.id}`).send(contractPayload())).status,
      ).toBe(404);
      expect((await s.other.del(`/insurances/contracts/${mine.id}`)).status).toBe(404);
      expect((await data()).contracts).toHaveLength(1);
    });
  });

  describe('settings', () => {
    it('saves and returns settings, rejects invalid ones', async () => {
      const saved = await s.member
        .put('/insurances/settings')
        .send(settingsPayload({ dismissedRequirements: ['LEGAL'], includeSocial: false }));
      expect(saved.status).toBe(200);
      expect((saved.body as InsuranceSettings).dismissedRequirements).toEqual(['LEGAL']);
      expect((await data()).settings.includeSocial).toBe(false);

      const bad = await s.member
        .put('/insurances/settings')
        .send(settingsPayload({ reminders: { enabled: true, leadDays: 2 } }));
      expect(bad.status).toBe(400);
      expect(bad.body.details).toEqual([{ field: 'reminders.leadDays', message: 'OUT_OF_RANGE' }]);
      expect(
        (await s.member.put('/insurances/settings').send({ ...settingsPayload(), x: 1 })).body
          .error,
      ).toBe('INSURANCES_UNKNOWN_FIELD');
    });
  });

  describe('linked social lines', () => {
    const importRecords = (who: typeof s.withEarnings, from: string, count: number) => {
      const file: EarningsImportFile = {
        clientFileId: 'f',
        fileName: 'earnings-export.json',
        sourceType: 'EXPORT_JSON',
        fileSha256: sha(`${from}-${count}`),
        parserId: 'earnings-export',
        parserVersion: '1',
        records: periods(from, count).map((p) => balancedRecord(p)),
        certificates: [],
      };
      return who.post('/earnings/imports').send({ files: [file] });
    };

    it('derives the lines from the latest payslip and updates with newer imports', async () => {
      expect((await importRecords(s.withEarnings, '2026-01', 2)).status).toBe(201);
      const first = await data(s.withEarnings);
      expect(first.linkedSocial).toEqual([
        { kind: 'HEALTH', monthly: '400.00', period: '2026-02' },
        { kind: 'CARE', monthly: '90.00', period: '2026-02' },
        { kind: 'PENSION', monthly: '465.00', period: '2026-02' },
        { kind: 'UNEMPLOYMENT', monthly: '65.00', period: '2026-02' },
      ]);
      await importRecords(s.withEarnings, '2026-03', 1);
      expect((await data(s.withEarnings)).linkedSocial[0].period).toBe('2026-03');
    });

    it('is empty without earnings access or data, and nothing is stored', async () => {
      expect((await data(s.member)).linkedSocial).toEqual([]);
      expect((await data(s.withEarnings)).linkedSocial).toEqual([]);
      const tables = await t.database.query<{ total: number }>(
        'SELECT COUNT(*) AS total FROM insurance_contracts',
      );
      expect(tables[0].total).toBe(0);
    });

    it('stays empty for a member of insurances only, even with another user holding data', async () => {
      await importRecords(s.withEarnings, '2026-01', 1);
      expect((await data(s.member)).linkedSocial).toEqual([]);
    });
  });

  describe('delete all and account lifecycle', () => {
    it('removes contracts, settings and reminder log of the caller only', async () => {
      const mine = await create();
      await create(contractPayload(), s.other);
      await s.member.put('/insurances/settings').send(settingsPayload());
      t.get(InsurancesRepository).claimReminder(s.memberId, mine.id, '2026-09-30');

      expect((await s.member.del('/insurances')).status).toBe(204);
      expect((await data()).contracts).toEqual([]);
      expect((await data()).settings.reminders.enabled).toBe(false);
      const log = await t.database.query('SELECT * FROM insurance_reminder_log');
      expect(log).toEqual([]);
      expect((await data(s.other)).contracts).toHaveLength(1);
    });

    it('purges everything with the account', async () => {
      const goneId = await createMember(t.database, 'gone@example.com', ['insurances']);
      const gone = client(t.app, await signIn(t.app, 'gone@example.com'));
      await create(contractPayload(), gone);
      await gone.put('/insurances/settings').send(settingsPayload());
      await t.get(UsersRepository).deleteById(goneId);
      for (const table of ['insurance_contracts', 'insurance_settings'])
        expect(
          await t.database.query(`SELECT 1 FROM ${table} WHERE owner_id = $1`, [goneId]),
        ).toEqual([]);
    });

    it('logs ids and counts only', async () => {
      const spy = jest.spyOn(Logger.prototype, 'log');
      await create();
      expect(JSON.stringify(spy.mock.calls)).not.toContain(SECRET_NAME);
      spy.mockRestore();
    });
  });

  describe('reminders', () => {
    // Term end 2026-12-31 with 3 months' notice → deadline 2026-09-30.
    const dueContract = (over: object = {}) =>
      contractPayload({
        type: 'CAR',
        name: 'Golf',
        endDate: '2026-12-31',
        cancellation: { autoRenew: true, period: { value: 3, unit: 'MONTHS' } },
        ...over,
      });
    const sweep = (today: string) => t.get(InsurancesReminderService).sweep(today);
    const enable = (over: Record<string, unknown> = {}) =>
      s.member.put('/insurances/settings').send(settingsPayload(over));

    it('sends exactly one mail per deadline inside the lead time', async () => {
      await create(dueContract());
      await enable();
      expect(await sweep('2026-09-10')).toBe(1);
      expect(await sweep('2026-09-11')).toBe(0);
      expect(t.mail.sent).toHaveLength(1);
      expect(t.mail.sent[0].to).toBe('member@example.com');
      expect(t.mail.sent[0].subject).toContain('Golf');
      expect(t.mail.sent[0].subject).toContain('2026-09-30');
      expect(t.mail.sent[0].text).toContain('https://vaultfolio.example.com/app/insurances');
      expect(t.mail.sent[0].text).not.toContain('96');
      expect(t.mail.sent[0].text).not.toContain(SECRET_NUMBER);
    });

    it('does nothing outside the lead time, once the deadline passed, or by default', async () => {
      await create(dueContract());
      expect(await sweep('2026-09-10')).toBe(0); // reminders default to off
      await enable();
      expect(await sweep('2026-07-01')).toBe(0);
      expect(await sweep('2026-10-01')).toBe(0);
      expect(t.mail.sent).toEqual([]);
    });

    it('respects the per-contract switch, inactive contracts and deleted contracts', async () => {
      await enable();
      await create(dueContract({ reminderEnabled: false }));
      await create(dueContract({ status: 'CANCELLED' }));
      const deleted = await create(dueContract());
      await s.member.del(`/insurances/contracts/${deleted.id}`);
      expect(await sweep('2026-09-10')).toBe(0);
    });

    it('uses the lead time of the user', async () => {
      await create(dueContract());
      await enable({ reminders: { enabled: true, leadDays: 7 } });
      expect(await sweep('2026-09-10')).toBe(0);
      expect(await sweep('2026-09-23')).toBe(1);
    });

    it('writes in the language of the user', async () => {
      await t.database.query("UPDATE users SET email_language = 'de' WHERE id = $1", [s.memberId]);
      await create(dueContract());
      await enable();
      await sweep('2026-09-10');
      expect(t.mail.sent[0].subject).toBe('Kündigungsfrist für "Golf" am 2026-09-30');
      expect(t.mail.sent[0].text).toContain('Kfz-Versicherung');
    });

    it('retries after a failed send and reminds again for the next term', async () => {
      await create(dueContract({ endDate: undefined, startDate: '2025-01-01' }));
      await enable();
      t.mail.failNext = true;
      expect(await sweep('2026-09-10')).toBe(0);
      expect(await sweep('2026-09-10')).toBe(1);
      expect(await sweep('2026-09-11')).toBe(0);
      expect(await sweep('2027-09-01')).toBe(1);
      expect(t.mail.sent).toHaveLength(2);
    });

    it('does nothing for a deactivated owner', async () => {
      await create(dueContract());
      await enable();
      await t.database.query("UPDATE users SET status = 'ARCHIVED' WHERE id = $1", [s.memberId]);
      expect(await sweep('2026-09-10')).toBe(0);
      await t.database.query("UPDATE users SET status = 'ACTIVE' WHERE id = $1", [s.memberId]);
    });
  });
});

describe('/insurances without a key', () => {
  let t: InsurancesTestApp;

  beforeAll(async () => {
    t = await bootInsurancesApp({ key: null });
    await signInSessions(t);
  });

  afterAll(async () => {
    await t.close();
  });

  it('answers 503 on every route and sends no reminders', async () => {
    const member = client(t.app, await signIn(t.app, 'member@example.com'));
    for (const response of [
      await member.get('/insurances'),
      await member.post('/insurances/contracts').send(contractPayload()),
      await member.put('/insurances/settings').send(settingsPayload()),
      await member.del('/insurances'),
    ]) {
      expect(response.status).toBe(503);
      expect(response.body.error).toBe('INSURANCES_UNAVAILABLE');
    }
    expect(await t.get(InsurancesReminderService).sweep('2026-09-10')).toBe(0);
  });
});
