import type {
  EarningsFilePreview,
  EarningsImportFile,
  EarningsImportSummary,
} from '@vaultfolio/api-contract';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { randomBytes } from 'node:crypto';
import { Logger } from '@nestjs/common';
import { readEarningsExport, toImportFile } from '@vaultfolio/earnings';
import {
  largeExport,
  LSTB_2025_BRIGHTLINE,
  SAP_AUG_2026,
  SAP_DEC_2025_BONUS,
  SAP_MAR_2026_VOLUNTARY,
  SAP_SEP_2026_WITH_CORRECTION,
} from '@vaultfolio/earnings/testing';
import {
  ADMIN_EMAIL,
  balancedRecord,
  bootEarningsApp,
  client,
  createMember,
  type EarningsTestApp,
  importFileFromPages,
  periods,
  sha,
  signIn,
} from './earnings-e2e.helpers';

/**
 * HTTP e2e for `/earnings` (contracts/earnings-api.md) against a temp SQLite file with a test
 * encryption key. All documents are synthetic with invented figures.
 */
describe('/earnings', () => {
  let t: EarningsTestApp;
  let member: ReturnType<typeof client>;
  let admin: ReturnType<typeof client>;
  let noScope: ReturnType<typeof client>;
  let memberB: ReturnType<typeof client>;

  const sep = () =>
    importFileFromPages(SAP_SEP_2026_WITH_CORRECTION.pages, {
      clientFileId: 'sep',
      fileName: SAP_SEP_2026_WITH_CORRECTION.fileName,
    });
  const aug = (clientFileId = 'aug', shaSeed?: string) =>
    importFileFromPages(SAP_AUG_2026.pages, {
      clientFileId,
      fileName: SAP_AUG_2026.fileName,
      shaSeed,
    });

  beforeAll(async () => {
    t = await bootEarningsApp();
    await createMember(t.database, 'member@example.com', ['holdings', 'earnings']);
    await createMember(t.database, 'member-b@example.com', ['earnings']);
    await createMember(t.database, 'no-scope@example.com', ['holdings']);
    member = client(t.app, await signIn(t.app, 'member@example.com'));
    memberB = client(t.app, await signIn(t.app, 'member-b@example.com'));
    noScope = client(t.app, await signIn(t.app, 'no-scope@example.com'));
    admin = client(t.app, await signIn(t.app, ADMIN_EMAIL));
  });

  afterAll(async () => {
    await t.close();
  });

  beforeEach(async () => {
    for (const table of [
      'earnings_records',
      'earnings_certificates',
      'earnings_imports',
      'earnings_employers',
    ]) {
      await t.database.query(`DELETE FROM ${table}`);
    }
  });

  const preview = (files: EarningsImportFile[]) =>
    member.post('/earnings/imports/preview').send({ files });
  const commit = (files: EarningsImportFile[]) => member.post('/earnings/imports').send({ files });
  const byId = (files: EarningsFilePreview[]) =>
    Object.fromEntries(files.map((f) => [f.clientFileId, f]));

  describe('access', () => {
    it('401 without a session, 403 without the earnings scope', async () => {
      const { default: request } = await import('supertest');
      expect((await request(t.app.getHttpServer()).get('/earnings/imports')).status).toBe(401);
      const response = await noScope.get('/earnings/imports');
      expect(response.status).toBe(403);
      expect(response.body.error).toBe('forbidden');
      expect(
        (await noScope.post('/earnings/imports/preview').send({ files: [sep()] })).status,
      ).toBe(403);
    });

    it('lets entitled members and admins in', async () => {
      expect((await member.get('/earnings/imports')).status).toBe(200);
      expect((await admin.get('/earnings/imports')).status).toBe(200);
    });
  });

  describe('POST /earnings/imports/preview', () => {
    it('classifies a new file and writes nothing', async () => {
      const response = await preview([sep()]);
      expect(response.status).toBe(200);
      expect(response.body.files).toEqual([
        {
          clientFileId: 'sep',
          status: 'NEW',
          employers: ['Brightline Software GmbH'],
          periods: ['2026-07', '2026-09'],
          years: [],
          recordCount: 2,
          certificateCount: 0,
          includesCorrection: true,
          replaces: [],
          duplicateOf: null,
          conflictsWith: null,
          rejection: null,
        },
      ]);
      expect(await t.database.query('SELECT id FROM earnings_imports')).toEqual([]);
      expect(await t.database.query('SELECT id FROM earnings_records')).toEqual([]);
    });

    it('marks DUPLICATE (same fingerprint) and REPLACES (same identity) against stored data', async () => {
      await commit([aug()]);
      const [stored] = (await member.get('/earnings/imports')).body as EarningsImportSummary[];

      const response = await preview([aug('again'), aug('redownload', 'other bytes')]);
      const files = byId(response.body.files);
      expect(files['again'].status).toBe('DUPLICATE');
      expect(files['again'].duplicateOf).toEqual({
        importId: stored.id,
        importedAt: stored.importedAt,
        fileName: stored.fileName,
      });
      expect(files['redownload'].status).toBe('REPLACES');
      expect(files['redownload'].replaces).toEqual([
        {
          employer: 'Brightline Software GmbH',
          period: '2026-08',
          kind: 'REGULAR',
          seq: 1,
          year: null,
          importedAt: stored.importedAt,
          fileName: SAP_AUG_2026.fileName,
        },
      ]);
    });

    it('rejects tampered amounts with CHECK_FAILED and unknown keys with EARNINGS_UNKNOWN_FIELD', async () => {
      const tampered = aug('tampered');
      tampered.records[0].amounts.net = '3128.40';
      const extra = aug('extra', 'extra');
      (extra.records[0] as unknown as Record<string, unknown>)['taxId'] = '12345678901';
      const response = await preview([tampered, extra]);
      const files = byId(response.body.files);
      expect(files['tampered']).toMatchObject({
        status: 'REJECTED',
        rejection: {
          code: 'CHECK_FAILED',
          params: { check: 'NET', period: '2026-08', difference: '12.40' },
        },
      });
      expect(files['extra']).toMatchObject({
        status: 'REJECTED',
        rejection: { code: 'EARNINGS_UNKNOWN_FIELD', params: { path: 'records[0].taxId' } },
      });
    });

    it('resolves an identity conflict inside one batch: the later file wins, both are flagged', async () => {
      const response = await preview([aug('first', 'a'), aug('second', 'b')]);
      const files = byId(response.body.files);
      expect(files['first']).toMatchObject({
        status: 'REJECTED',
        conflictsWith: 'second',
        rejection: { code: 'BATCH_CONFLICT', params: { period: '2026-08', with: 'second' } },
      });
      expect(files['second']).toMatchObject({ status: 'NEW', conflictsWith: 'first' });
    });

    it('flags the same file twice in one batch as a duplicate', async () => {
      const response = await preview([aug('one'), aug('two')]);
      expect(byId(response.body.files)['two']).toMatchObject({
        status: 'DUPLICATE',
        duplicateOf: null,
        conflictsWith: 'one',
      });
    });

    it('rejects a malformed envelope as a whole', async () => {
      expect(
        (await member.post('/earnings/imports/preview').send({ files: [sep()], notes: 'x' })).body,
      ).toMatchObject({
        error: 'EARNINGS_UNKNOWN_FIELD',
        details: [{ field: 'notes', message: 'EARNINGS_UNKNOWN_FIELD' }],
      });
      expect((await member.post('/earnings/imports/preview').send({ files: [] })).body.error).toBe(
        'INVALID_BATCH',
      );
      expect(
        (await member.post('/earnings/imports/preview').send({ files: [{ fileName: 'x' }] }))
          .status,
      ).toBe(400);
    });
  });

  describe('POST /earnings/imports', () => {
    it('re-validates and saves NEW/REPLACES files, skipping DUPLICATE and REJECTED', async () => {
      await commit([aug()]);
      const tampered = sep();
      tampered.clientFileId = 'tampered';
      tampered.fileSha256 = sha('tampered');
      tampered.records[0].amounts.gross = '5300.00';

      const response = await commit([sep(), aug('dup'), aug('replace', 'replace'), tampered]);
      expect(response.status).toBe(201);
      expect(response.body.files).toEqual([
        {
          clientFileId: 'sep',
          status: 'SAVED',
          importId: expect.any(String),
          recordCount: 2,
          certificateCount: 0,
        },
        { clientFileId: 'dup', status: 'SKIPPED_DUPLICATE' },
        {
          clientFileId: 'replace',
          status: 'SAVED',
          importId: expect.any(String),
          recordCount: 1,
          certificateCount: 0,
        },
        {
          clientFileId: 'tampered',
          status: 'REJECTED',
          rejection: {
            code: 'CHECK_FAILED',
            params: { check: 'NET', period: '2026-09', difference: '-100.00' },
          },
        },
      ]);
      const rows = await t.database.query<{ period: string }>(
        'SELECT period FROM earnings_records ORDER BY period',
      );
      expect(rows.map((r) => r.period)).toEqual(['2026-07', '2026-08', '2026-09']);
    });

    it('lists the history newest first with derived counts and periods', async () => {
      await commit([aug()]);
      await commit([sep()]);
      await commit([aug('replace', 'replace')]);
      const history = (await member.get('/earnings/imports')).body as EarningsImportSummary[];
      expect(history.map((h) => [h.fileName, h.recordCount, h.firstPeriod, h.lastPeriod])).toEqual([
        [SAP_AUG_2026.fileName, 1, '2026-08', '2026-08'],
        [SAP_SEP_2026_WITH_CORRECTION.fileName, 2, '2026-07', '2026-09'],
        [SAP_AUG_2026.fileName, 0, null, null],
      ]);
      expect(history[0]).toMatchObject({
        sourceType: 'PAYSLIP_PDF',
        parserId: 'sap-entgeltnachweis',
        parserVersion: '1.0.0',
        certificateCount: 0,
        employers: ['Brightline Software GmbH'],
        years: [],
      });
    });
  });

  describe('body size limits', () => {
    it('accepts a > 100 kB import body but keeps 100 kB on other routes', async () => {
      const big: EarningsImportFile = {
        clientFileId: 'big',
        fileName: 'earnings-export.json',
        sourceType: 'EXPORT_JSON',
        fileSha256: sha('big'),
        parserId: 'earnings-export',
        parserVersion: '1',
        records: periods('2005-01', 260).map((p) => balancedRecord(p)),
        certificates: [],
      };
      const body = JSON.stringify({ files: [big] });
      expect(body.length).toBeGreaterThan(100 * 1024);
      const response = await member
        .post('/earnings/imports')
        .set('Content-Type', 'application/json')
        .send(body);
      expect(response.status).toBe(201);
      expect(response.body.files[0]).toMatchObject({ status: 'SAVED', recordCount: 260 });

      const other = await member
        .post('/holdings')
        .set('Content-Type', 'application/json')
        .send(JSON.stringify({ padding: 'x'.repeat(110 * 1024) }));
      expect(other.status).toBe(413);
    });
  });

  it('keeps members apart', async () => {
    await commit([aug()]);
    expect((await memberB.get('/earnings/imports')).body).toEqual([]);
  });

  // ---------------------------------------------------------------- US2 read models

  const dec = () =>
    importFileFromPages(SAP_DEC_2025_BONUS.pages, {
      clientFileId: 'dec',
      fileName: SAP_DEC_2025_BONUS.fileName,
    });
  const mar = () =>
    importFileFromPages(SAP_MAR_2026_VOLUNTARY.pages, {
      clientFileId: 'mar',
      fileName: SAP_MAR_2026_VOLUNTARY.fileName,
    });
  const cert = (clientFileId = 'cert', shaSeed?: string) =>
    importFileFromPages(LSTB_2025_BRIGHTLINE.pages, {
      clientFileId,
      fileName: LSTB_2025_BRIGHTLINE.fileName,
      shaSeed,
    });

  describe('read models (US2)', () => {
    beforeEach(async () => {
      expect((await commit([dec(), mar(), aug(), sep()])).status).toBe(201);
    });

    it('GET /earnings/overview returns exact career, latest-year and series values', async () => {
      const response = await member.get('/earnings/overview');
      expect(response.status).toBe(200);
      const o = response.body;
      expect(o.hasData).toBe(true);
      // gross 8000.00 + 7000.00 + 5000.00 + 5200.00 − 120.00; one employer → no whole-career entry
      expect(o.career).toEqual([
        {
          key: expect.any(String),
          label: 'Brightline Software GmbH',
          firstPeriod: '2025-12',
          lastPeriod: '2026-09',
          monthsEmployed: 4,
          employerCount: 1,
          totals: {
            gross: '25080.00',
            net: '15373.12',
            taxes: '5205.33',
            social: '4501.55',
            bonus: '3000.00',
          },
          perMonth: {
            gross: '6270.00',
            net: '3843.28',
            taxes: '1301.33',
            social: '1125.39',
            bonus: '750.00',
          },
          netRatio: '0.6130',
        },
      ]);
      expect(o.latestYear).toEqual({
        year: 2026,
        months: 9,
        comparedMonths: [1, 9],
        current: {
          gross: '17080.00',
          net: '10597.35',
          taxes: '3369.33',
          social: '3113.32',
          bonus: '0.00',
          netRatio: '0.6205',
        },
        previous: null,
      });
      expect(o.yearly).toEqual([
        {
          year: 2025,
          monthsEmployed: 1,
          gross: '8000.00',
          regular: '5000.00',
          bonus: '3000.00',
          net: '4775.77',
          taxes: '1836.00',
          social: '1388.23',
          taxRatio: '0.2295',
          socialRatio: '0.1735',
        },
        {
          year: 2026,
          monthsEmployed: 3,
          gross: '17080.00',
          regular: '17080.00',
          bonus: '0.00',
          net: '10597.35',
          taxes: '3369.33',
          social: '3113.32',
          taxRatio: '0.1973',
          socialRatio: '0.1823',
        },
      ]);
      expect(o.monthly.map((m: { period: string }) => m.period)).toEqual([
        '2025-12',
        '2026-03',
        '2026-07',
        '2026-08',
        '2026-09',
      ]);
      expect(o.monthly[2]).toMatchObject({
        gross: '-120.00',
        net: '-62.85',
        payout: '0.00',
        hasCorrection: true,
      });
      expect(o.employerChanges).toEqual([]);
      expect(o.dataCheckIssues).toBe(1);
    });

    it('GET /earnings/records?period= returns the month detail with import and checks', async () => {
      const response = await member.get('/earnings/records?period=2026-07');
      expect(response.status).toBe(200);
      expect(response.body).toEqual([
        {
          id: expect.any(String),
          employerId: expect.any(String),
          employerLabel: 'Brightline Software GmbH',
          period: '2026-07',
          issued: '2026-09',
          kind: 'CORRECTION',
          seq: 3,
          amounts: expect.objectContaining({
            gross: '-120.00',
            net: '-62.85',
            other: '62.85',
            payout: null,
            checks: [{ code: 'NET', passed: true, difference: '0.00' }],
          }),
          import: { id: expect.any(String), fileName: SAP_SEP_2026_WITH_CORRECTION.fileName },
        },
      ]);
      expect((await member.get('/earnings/records')).body).toHaveLength(5);
      expect((await member.get('/earnings/records?period=2026-13')).status).toBe(400);
    });

    it('GET /earnings/tables returns the grid and taxes per year', async () => {
      const t2 = (await member.get('/earnings/tables')).body;
      expect(t2.monthGrid.years).toEqual([2025, 2026]);
      expect(t2.monthGrid.bonusPeriods).toEqual(['2025-12']);
      expect(t2.monthGrid.missingPeriods).toEqual(['2026-04', '2026-05', '2026-06', '2026-07']);
      expect(t2.monthGrid.metrics.gross['2026-09']).toBe('5200.00');
      expect(
        t2.taxesPerYear.map((r: { year: number; wageTax: string; health: string }) => [
          r.year,
          r.wageTax,
          r.health,
        ]),
      ).toEqual([
        [2025, '1700.00', '441.00'],
        [2026, '3119.75', '1066.40'],
      ]);
      expect(t2.certificates).toEqual([]);
    });

    it('filters every read model by employer', async () => {
      const [employer] = (await member.get('/earnings/employers')).body;
      expect(
        (await member.get(`/earnings/overview?employer=${employer.id}`)).body.career,
      ).toHaveLength(1);
      const other = '00000000-0000-0000-0000-000000000000';
      expect((await member.get(`/earnings/overview?employer=${other}`)).body).toMatchObject({
        hasData: false,
        monthly: [],
      });
      expect((await member.get(`/earnings/tables?employer=${other}`)).body.taxesPerYear).toEqual(
        [],
      );
      expect((await member.get('/earnings/overview?employer=not-an-id')).status).toBe(400);
    });

    it('reports hasData: false for a new user', async () => {
      expect((await memberB.get('/earnings/overview')).body).toEqual({
        hasData: false,
        career: [],
        latestYear: null,
        yearly: [],
        monthly: [],
        employerChanges: [],
        dataCheckIssues: 0,
      });
    });
  });

  // ---------------------------------------------------------------- US3 certificates + data check

  describe('certificates and data check (US3)', () => {
    it('imports a certificate, replaces it per employer and year, and reports the data check', async () => {
      const p = await preview([cert()]);
      expect(p.body.files[0]).toMatchObject({
        status: 'NEW',
        years: [2025],
        periods: [],
        certificateCount: 1,
      });
      expect(
        (await commit([cert(), dec()])).body.files.map((f: { status: string }) => f.status),
      ).toEqual(['SAVED', 'SAVED']);
      const again = await preview([cert('again', 'reprint')]);
      expect(again.body.files[0]).toMatchObject({
        status: 'REPLACES',
        replaces: [expect.objectContaining({ year: 2025, period: null })],
      });
      await commit([cert('again', 'reprint')]);

      const tables = (await member.get('/earnings/tables')).body;
      expect(tables.certificates).toEqual([
        {
          id: expect.any(String),
          year: 2025,
          employerId: expect.any(String),
          employerLabel: 'Brightline Software GmbH',
          amounts: expect.objectContaining({ grossWage: '55000.00', wageTax: '8800.00' }),
          fileName: LSTB_2025_BRIGHTLINE.fileName,
        },
      ]);
      const check = (await member.get('/earnings/data-check')).body;
      expect(check).toEqual([
        expect.objectContaining({
          year: 2025,
          ytd: { status: 'NOT_AVAILABLE', compared: 0, differing: [] },
          certificate: expect.objectContaining({ status: 'DIFFERS', compared: 8 }),
          completeness: { status: 'COMPLETE', missingPeriods: [] },
        }),
      ]);
      const history = (await member.get('/earnings/imports')).body as EarningsImportSummary[];
      expect(
        history.find((h) => h.sourceType === 'CERTIFICATE_PDF' && h.certificateCount === 1)?.years,
      ).toEqual([2025]);
    });

    it('deleting a payslip import turns the check into MISSING without touching the certificate', async () => {
      const saved = (await commit([aug(), sep(), mar(), cert()])).body.files;
      const augImport = saved[0].importId;
      expect(
        (await member.get('/earnings/data-check')).body.find(
          (r: { year: number }) => r.year === 2026,
        ).completeness.missingPeriods,
      ).toEqual(['2026-04', '2026-05', '2026-06', '2026-07']);
      expect((await member.del(`/earnings/imports/${augImport}`)).status).toBe(204);
      const row = (await member.get('/earnings/data-check')).body.find(
        (r: { year: number }) => r.year === 2026,
      );
      expect(row.completeness).toEqual({
        status: 'MISSING',
        missingPeriods: ['2026-04', '2026-05', '2026-06', '2026-07', '2026-08'],
      });
      expect((await member.get('/earnings/tables')).body.certificates).toHaveLength(1);
    });
  });

  // ---------------------------------------------------------------- US4 companion export

  describe('companion export (US4)', () => {
    it('imports a full-career export (> 100 kB) through the same endpoints', async () => {
      const parsed = readEarningsExport(largeExport(260));
      if (!parsed.ok) throw new Error(parsed.error.code);
      const file = toImportFile(parsed, {
        clientFileId: 'export',
        fileName: 'earnings-export.json',
        sourceType: 'EXPORT_JSON',
        fileSha256: sha('export'),
        parserId: parsed.parserId,
        parserVersion: parsed.parserVersion,
      });
      expect(JSON.stringify({ files: [file] }).length).toBeGreaterThan(100 * 1024);
      const response = await commit([file]);
      expect(response.body.files[0]).toMatchObject({ status: 'SAVED', recordCount: 260 });
      const [summary] = (await member.get('/earnings/imports')).body as EarningsImportSummary[];
      expect(summary).toMatchObject({
        sourceType: 'EXPORT_JSON',
        parserId: 'earnings-export',
        parserVersion: '1',
        firstPeriod: '2005-01',
        lastPeriod: '2026-08',
      });
    });
  });

  // ---------------------------------------------------------------- US5 manage and delete

  describe('manage and delete (US5)', () => {
    it('DELETE /earnings/imports/:id removes exactly that import; unknown id → 404', async () => {
      const [a, b] = (await commit([aug(), sep()])).body.files;
      expect((await member.del(`/earnings/imports/${a.importId}`)).status).toBe(204);
      expect(
        (await member.get('/earnings/records')).body.map((r: { period: string }) => r.period),
      ).toEqual(['2026-07', '2026-09']);
      expect((await member.del(`/earnings/imports/${a.importId}`)).status).toBe(404);
      expect((await member.del(`/earnings/imports/${a.importId}`)).body.error).toBe(
        'EARNINGS_IMPORT_NOT_FOUND',
      );
      expect(b.status).toBe('SAVED');
    });

    it('DELETE /earnings removes everything → empty state', async () => {
      await commit([aug(), cert()]);
      expect((await member.del('/earnings')).status).toBe(204);
      expect((await member.get('/earnings/overview')).body.hasData).toBe(false);
      expect((await member.get('/earnings/imports')).body).toEqual([]);
      expect((await member.get('/earnings/employers')).body).toEqual([]);
    });

    it('renames an employer (display only) and rejects unknown keys', async () => {
      await commit([aug()]);
      const [employer] = (await member.get('/earnings/employers')).body;
      expect(employer).toEqual({
        id: expect.any(String),
        detectedName: 'Brightline Software GmbH',
        displayName: null,
      });
      const renamed = await member
        .put(`/earnings/employers/${employer.id}`)
        .send({ displayName: '  Brightline  ' });
      expect(renamed.status).toBe(200);
      expect(renamed.body.displayName).toBe('Brightline');
      expect((await member.get('/earnings/overview')).body.career[0]).toMatchObject({
        label: 'Brightline',
        totals: { gross: '5000.00' },
      });
      expect(
        (
          await member
            .put(`/earnings/employers/${employer.id}`)
            .send({ displayName: 'x', gross: '1.00' })
        ).body.error,
      ).toBe('EARNINGS_UNKNOWN_FIELD');
      expect(
        (
          await member
            .put(`/earnings/employers/${employer.id}`)
            .send({ displayName: 'x'.repeat(121) })
        ).status,
      ).toBe(400);
      await member.put(`/earnings/employers/${employer.id}`).send({ displayName: '' });
      expect((await member.get('/earnings/employers')).body[0].displayName).toBeNull();
    });
  });

  // ---------------------------------------------------------------- US6 privacy

  describe('privacy (US6)', () => {
    const READS = [
      '/earnings/overview',
      '/earnings/records',
      '/earnings/tables',
      '/earnings/data-check',
      '/earnings/imports',
      '/earnings/employers',
    ];

    it('other members and admins retrieve none of the owner’s data through any route', async () => {
      const [saved] = (await commit([aug(), cert()])).body.files;
      const [employer] = (await member.get('/earnings/employers')).body;
      for (const other of [memberB, admin]) {
        for (const url of READS) {
          const body = (await other.get(url)).body;
          expect(JSON.stringify(body)).not.toMatch(/5000\.00|Brightline|3116/);
        }
        expect((await other.del(`/earnings/imports/${saved.importId}`)).status).toBe(404);
        expect(
          (await other.put(`/earnings/employers/${employer.id}`).send({ displayName: 'x' })).status,
        ).toBe(404);
      }
      expect((await member.get('/earnings/imports')).body).toHaveLength(2);
    });

    it('a member without the scope gets 403 on every route', async () => {
      for (const url of READS) expect((await noScope.get(url)).status).toBe(403);
      expect((await noScope.post('/earnings/imports').send({ files: [aug()] })).status).toBe(403);
      expect((await noScope.del('/earnings')).status).toBe(403);
      expect((await noScope.del('/earnings/imports/x')).status).toBe(403);
      expect((await noScope.put('/earnings/employers/x').send({ displayName: 'x' })).status).toBe(
        403,
      );
    });

    it('the database file contains no imported amount in any form', async () => {
      await commit([sep(), aug(), cert()]);
      await t.database.query('PRAGMA wal_checkpoint(FULL)');
      const dbPath = path.join(t.tempDir, 'test.db');
      const bytes = [dbPath, `${dbPath}-wal`]
        .filter((f) => fs.existsSync(f))
        .map((f) => fs.readFileSync(f).toString('latin1'))
        .join('');
      for (const amount of [
        '5200.00',
        '5.200,00',
        '520000',
        '3221.20',
        '3.221,20',
        '322120',
        '3118.35',
        '311835',
        '55000.00',
        '55.000,00',
        '8800.00',
        '3116.00',
        '311600',
      ]) {
        expect(bytes).not.toContain(amount);
      }
    });

    it('logs only import metadata — no amounts, differences or document text', async () => {
      const lines: string[] = [];
      const capture = (...args: unknown[]) =>
        void lines.push(
          args
            .map((a) =>
              typeof a === 'string'
                ? a
                : JSON.stringify(a, Object.getOwnPropertyNames(a ?? {})) + JSON.stringify(a),
            )
            .join(' '),
        );
      const spies = (['log', 'warn', 'error', 'debug', 'verbose'] as const).map((m) =>
        jest.spyOn(Logger.prototype, m).mockImplementation(capture),
      );
      try {
        const tampered = aug('tampered', 'tampered');
        tampered.records[0].amounts.net = '3128.40';
        await preview([sep(), tampered]);
        await commit([sep(), tampered, aug()]);
        for (const url of READS) await member.get(url);
        await member.get('/earnings/records?period=2026-13');
      } finally {
        spies.forEach((s) => s.mockRestore());
      }
      const log = lines.join('\n');
      for (const secret of [
        '5200.00',
        '5.200,00',
        '3221.20',
        '3128.40',
        '12.40',
        '3116.00',
        'Entgeltnachweis für',
        'Tarifgehalt',
        'Brightline',
      ]) {
        expect(log).not.toContain(secret);
      }
      const imports = lines.filter(
        (l) => l.includes('EarningsImport') && l.includes('"outcome":"SAVED"'),
      );
      expect(imports).toHaveLength(2);
      expect(imports[0]).toMatch(
        /"importId":"[0-9a-f-]{36}".*"parserId":"sap-entgeltnachweis".*"parserVersion":"1.0.0".*"records":2/,
      );
    });
  });
});

describe('/earnings without a usable key (FR-044)', () => {
  it('answers 503 on every earnings route without a key; other domains keep working', async () => {
    const t = await bootEarningsApp({ key: null });
    try {
      const admin = client(t.app, await signIn(t.app, ADMIN_EMAIL));
      for (const url of [
        '/earnings/overview',
        '/earnings/records',
        '/earnings/tables',
        '/earnings/data-check',
        '/earnings/imports',
        '/earnings/employers',
      ]) {
        const response = await admin.get(url);
        expect(response.status).toBe(503);
        expect(response.body.error).toBe('EARNINGS_UNAVAILABLE');
      }
      expect((await admin.post('/earnings/imports').send({ files: [] })).status).toBe(503);
      expect((await admin.get('/holdings')).status).toBe(200);
    } finally {
      await t.close();
    }
  });

  it('fails closed when the key differs from the one the data was stored with', async () => {
    const first = await bootEarningsApp({ key: randomBytes(32).toString('base64') });
    const tempDir = first.tempDir;
    const adminFirst = client(first.app, await signIn(first.app, ADMIN_EMAIL));
    const file = importFileFromPages(SAP_AUG_2026.pages, {
      clientFileId: 'aug',
      fileName: SAP_AUG_2026.fileName,
    });
    expect((await adminFirst.post('/earnings/imports').send({ files: [file] })).status).toBe(201);
    await first.close();

    const second = await bootEarningsApp({ key: randomBytes(32).toString('base64'), tempDir });
    try {
      const admin = client(second.app, await signIn(second.app, ADMIN_EMAIL));
      const overview = await admin.get('/earnings/overview');
      expect(overview.status).toBe(503);
      expect(JSON.stringify(overview.body)).not.toContain('5000');
      expect((await admin.post('/earnings/imports/preview').send({ files: [file] })).status).toBe(
        503,
      );
      expect((await admin.get('/holdings')).status).toBe(200);
    } finally {
      await second.close();
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
