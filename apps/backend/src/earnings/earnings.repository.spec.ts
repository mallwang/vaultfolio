import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { randomBytes } from 'node:crypto';
import Sqlite from 'better-sqlite3';
import type { ImportFileInput } from '@vaultfolio/earnings';
import { evaluateChecks } from '@vaultfolio/earnings';
import { DatabaseService } from '../database/database.service';
import { EarningsCryptoService } from './earnings-crypto.service';
import { EarningsRepository } from './earnings.repository';

const OWNER = 'owner-a';
const OTHER = 'owner-b';
const EMPLOYER = 'Brightline Software GmbH';

function amounts(overrides: Record<string, unknown> = {}) {
  return {
    gross: '5000.00',
    taxGross: '5000.00',
    svGrossKv: '5000.00',
    svGrossRv: '5000.00',
    wageTax: '800.00',
    soli: '0.00',
    churchTax: '0.00',
    health: '400.00',
    care: '90.00',
    pension: '465.00',
    unemployment: '65.00',
    net: '3180.00',
    other: '0.00',
    payout: '3180.00',
    oneOff: {},
    employerSubsidy: null,
    ytd: null,
    ...overrides,
  };
}

let shaCounter = 0;
function file(periods: string[], overrides: Partial<ImportFileInput> = {}): ImportFileInput {
  shaCounter += 1;
  return {
    clientFileId: `f${shaCounter}`,
    fileName: `payslip-${shaCounter}.pdf`,
    sourceType: 'PAYSLIP_PDF',
    fileSha256: shaCounter.toString(16).padStart(64, '0'),
    parserId: 'sap-entgeltnachweis',
    parserVersion: '1.0.0',
    records: periods.map((period) => ({
      employer: EMPLOYER,
      period,
      issued: period,
      kind: 'REGULAR' as const,
      seq: 1,
      amounts: amounts(),
    })),
    certificates: [],
    ...overrides,
  };
}

describe('EarningsRepository (SQLite)', () => {
  let tempDir: string;
  let database: DatabaseService;
  let repository: EarningsRepository;

  function save(ownerId: string, f: ImportFileInput) {
    return repository.saveImportFile(ownerId, f, evaluateChecks(f.records).perRecord);
  }

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vaultfolio-earnings-repo-'));
    process.env.DATABASE_PATH = path.join(tempDir, 'test.db');
    process.env.EARNINGS_ENCRYPTION_KEY = randomBytes(32).toString('base64');
    database = new DatabaseService();
    await database.onModuleInit();
    const crypto = new EarningsCryptoService(database);
    crypto.onModuleInit();
    repository = new EarningsRepository(database, crypto);
  });

  afterEach(async () => {
    await database.onModuleDestroy();
    fs.rmSync(tempDir, { recursive: true, force: true });
    delete process.env.DATABASE_PATH;
    delete process.env.EARNINGS_ENCRYPTION_KEY;
  });

  describe('employers', () => {
    it('creates an employer on first mention and normalizes the name', () => {
      const a = repository.findOrCreateEmployer(OWNER, '  Brightline   Software GmbH ');
      const b = repository.findOrCreateEmployer(OWNER, EMPLOYER);
      expect(a).toBe(b);
      expect(repository.listEmployers(OWNER)).toEqual([
        { id: a, detectedName: EMPLOYER, displayName: null },
      ]);
      expect(repository.listEmployers(OTHER)).toEqual([]);
    });

    it('renames only the caller’s employer', () => {
      const id = repository.findOrCreateEmployer(OWNER, EMPLOYER);
      expect(repository.renameEmployer(OTHER, id, 'Hijack')).toBeNull();
      expect(repository.renameEmployer(OWNER, id, 'Brightline')).toEqual({
        id,
        detectedName: EMPLOYER,
        displayName: 'Brightline',
      });
      expect(repository.employerRefs(OWNER)).toEqual([{ id, label: 'Brightline' }]);
      repository.renameEmployer(OWNER, id, null);
      expect(repository.employerRefs(OWNER)).toEqual([{ id, label: EMPLOYER }]);
    });
  });

  describe('saveImportFile', () => {
    it('stores records encrypted and loads them decrypted with check results', () => {
      const { importId } = save(OWNER, file(['2026-08']));
      const raw = database.querySync<{ amounts_enc: string }>(
        'SELECT amounts_enc FROM earnings_records',
      );
      expect(raw).toHaveLength(1);
      expect(raw[0].amounts_enc).toMatch(/^v1:/);
      expect(raw[0].amounts_enc).not.toContain('5000');
      expect(raw[0].amounts_enc).not.toContain('3180');

      const [record] = repository.loadRecords(OWNER);
      expect(record.importId).toBe(importId);
      expect(record.period).toBe('2026-08');
      expect(record.amounts.gross).toBe('5000.00');
      expect(record.amounts.checks).toEqual([
        { code: 'NET', passed: true, difference: '0.00' },
        { code: 'PAYOUT', passed: true, difference: '0.00' },
      ]);
      expect(record.importFileName).toMatch(/^payslip-/);
      expect(repository.loadRecords(OTHER)).toEqual([]);
    });

    it('replaces an existing identity, leaving one row', () => {
      const first = save(OWNER, file(['2026-08']));
      const second = save(
        OWNER,
        file(['2026-08'], {
          records: [
            {
              ...file(['2026-08']).records[0],
              amounts: amounts({
                gross: '5100.00',
                taxGross: '5100.00',
                net: '3280.00',
                payout: '3280.00',
              }),
            },
          ],
        }),
      );
      const records = repository.loadRecords(OWNER);
      expect(records).toHaveLength(1);
      expect(records[0].importId).toBe(second.importId);
      expect(records[0].amounts.gross).toBe('5100.00');
      const history = repository.listImports(OWNER);
      expect(history.find((h) => h.id === first.importId)?.recordCount).toBe(0);
    });

    it('rolls back the whole file on failure', () => {
      save(OWNER, file(['2026-08']));
      // The second record violates the kind CHECK after the import row and the first record were written.
      const broken = file(['2026-09', '2026-10']);
      broken.records[1] = { ...broken.records[1], kind: 'BOGUS' as never };
      expect(() => repository.saveImportFile(OWNER, broken, [[], []])).toThrow(/CHECK/);
      expect(repository.loadRecords(OWNER).map((r) => r.period)).toEqual(['2026-08']);
      expect(repository.listImports(OWNER)).toHaveLength(1);
    });

    it('stores certificates and replaces them per employer and year', () => {
      const cert = (grossWage: string) => ({
        employer: EMPLOYER,
        year: 2025,
        amounts: {
          grossWage,
          wageTax: '0.00',
          soli: '0.00',
          churchTax: '0.00',
          multiYearComp: '0.00',
          multiYearWageTax: '0.00',
          multiYearSoli: '0.00',
          multiYearChurchTax: '0.00',
          pensionEmployer: '0.00',
          pensionEmployee: '0.00',
          employerSubsidyHealth: '0.00',
          employerSubsidyCare: '0.00',
          health: '0.00',
          care: '0.00',
          unemployment: '0.00',
        },
      });
      save(
        OWNER,
        file([], {
          sourceType: 'CERTIFICATE_PDF',
          parserId: 'lohnsteuerbescheinigung',
          certificates: [cert('60000.00')],
        }),
      );
      save(
        OWNER,
        file([], {
          sourceType: 'CERTIFICATE_PDF',
          parserId: 'lohnsteuerbescheinigung',
          certificates: [cert('61000.00')],
        }),
      );
      const certs = repository.loadCertificates(OWNER);
      expect(certs).toHaveLength(1);
      expect(certs[0].amounts.grossWage).toBe('61000.00');
      const raw = database.querySync<{ amounts_enc: string }>(
        'SELECT amounts_enc FROM earnings_certificates',
      );
      expect(raw[0].amounts_enc).not.toContain('61000');
      const [latest] = repository.listImports(OWNER);
      expect(latest.certificateCount).toBe(1);
      expect(latest.years).toEqual([2025]);
    });
  });

  describe('lookups and history', () => {
    it('finds imports by fingerprint and record identities, owner-scoped', () => {
      const f = file(['2026-08']);
      const { importId } = save(OWNER, f);
      expect(repository.findImportBySha(OWNER, f.fileSha256)).toEqual({
        importId,
        importedAt: expect.any(String),
        fileName: f.fileName,
      });
      expect(repository.findImportBySha(OTHER, f.fileSha256)).toBeNull();
      const identities = repository.recordIdentities(OWNER);
      expect([...identities.keys()]).toEqual([`${EMPLOYER}|2026-08|REGULAR|1`]);
      expect(repository.recordIdentities(OTHER).size).toBe(0);
    });

    it('lists imports newest first with derived counts, periods and employers', () => {
      save(OWNER, file(['2026-07', '2026-08']));
      save(OWNER, file(['2026-09']));
      save(OTHER, file(['2026-09']));
      const history = repository.listImports(OWNER);
      expect(history.map((h) => [h.recordCount, h.firstPeriod, h.lastPeriod])).toEqual([
        [1, '2026-09', '2026-09'],
        [2, '2026-07', '2026-08'],
      ]);
      expect(history[0].employers).toEqual([EMPLOYER]);
      expect(history[0].parserId).toBe('sap-entgeltnachweis');
    });
  });

  describe('deletion', () => {
    it('deleteImport removes exactly its records and orphaned employers', () => {
      const a = save(OWNER, file(['2026-07']));
      save(OWNER, file(['2026-08']));
      const other = file(['2026-09'], {
        records: [{ ...file(['2026-09']).records[0], employer: 'Other Employer AG' }],
      });
      const b = save(OWNER, other);

      expect(repository.deleteImport(OTHER, a.importId)).toBe(false);
      expect(repository.deleteImport(OWNER, a.importId)).toBe(true);
      expect(repository.loadRecords(OWNER).map((r) => r.period)).toEqual(['2026-08', '2026-09']);
      expect(repository.deleteImport(OWNER, b.importId)).toBe(true);
      expect(repository.listEmployers(OWNER).map((e) => e.detectedName)).toEqual([EMPLOYER]);
      expect(repository.deleteImport(OWNER, 'missing')).toBe(false);
    });

    it('deleteAllForOwner empties every table for that owner only', () => {
      save(OWNER, file(['2026-08']));
      save(OTHER, file(['2026-08']));
      repository.deleteAllForOwner(OWNER);
      expect(repository.hasData(OWNER)).toBe(false);
      expect(repository.listImports(OWNER)).toEqual([]);
      expect(repository.listEmployers(OWNER)).toEqual([]);
      expect(repository.hasData(OTHER)).toBe(true);
    });
  });

  describe('corrected figures (FR-012a)', () => {
    function correctedFile(): ImportFileInput {
      const base = file(['2026-08']);
      return {
        ...base,
        records: [
          { ...base.records[0], corrected: ['wageTax', 'net'] },
          { ...file(['2026-09']).records[0] },
        ],
      };
    }

    it('round-trips the names inside the encrypted payload and reads old rows as []', () => {
      save(OWNER, correctedFile());
      const raw = database.querySync<{ amounts_enc: string }>(
        'SELECT amounts_enc FROM earnings_records',
      );
      expect(raw.every((r) => !r.amounts_enc.includes('wageTax'))).toBe(true);
      const [aug, sep] = repository.loadRecords(OWNER);
      expect(aug.amounts.corrected).toEqual(['wageTax', 'net']);
      expect(sep.amounts.corrected).toEqual([]);
    });

    it('stores corrected_count per import and returns it in the history', () => {
      save(OWNER, file(['2026-07']));
      save(OWNER, correctedFile());
      const history = repository.listImports(OWNER);
      expect(history.map((h) => h.correctedCount)).toEqual([2, 0]);
      expect(
        database.querySync<{ corrected_count: number }>(
          'SELECT corrected_count FROM earnings_imports ORDER BY corrected_count',
        ),
      ).toEqual([{ corrected_count: 0 }, { corrected_count: 2 }]);
    });

    it('adds the column to a database created without it, idempotently', async () => {
      await database.onModuleDestroy();
      const legacyPath = path.join(tempDir, 'legacy.db');
      const legacy = new Sqlite(legacyPath);
      legacy.exec(`CREATE TABLE earnings_imports (
        id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, file_name TEXT NOT NULL,
        source_type TEXT NOT NULL, file_sha256 TEXT NOT NULL, parser_id TEXT NOT NULL,
        parser_version TEXT NOT NULL, imported_at TEXT NOT NULL, UNIQUE (owner_id, file_sha256))`);
      legacy
        .prepare(
          `INSERT INTO earnings_imports VALUES ('old', 'o', 'a.pdf', 'PAYSLIP_PDF', ?, 'p', '1', 'now')`,
        )
        .run('c'.repeat(64));
      legacy.close();

      process.env.DATABASE_PATH = legacyPath;
      for (let round = 0; round < 2; round += 1) {
        const migrated = new DatabaseService();
        await migrated.onModuleInit();
        expect(
          migrated.querySync<{ corrected_count: number }>(
            'SELECT corrected_count FROM earnings_imports',
          ),
        ).toEqual([{ corrected_count: 0 }]);
        await migrated.onModuleDestroy();
      }
      database = new DatabaseService();
      process.env.DATABASE_PATH = path.join(tempDir, 'test.db');
    });
  });

  describe('recognised text (034)', () => {
    it('stores ocr_read per import and returns recognisedText in the history, defaulting to false', () => {
      save(OWNER, file(['2026-07']));
      save(OWNER, file(['2026-08'], { recognisedText: true }));
      save(OWNER, file(['2026-09'], { recognisedText: false }));
      expect(repository.listImports(OWNER).map((h) => h.recognisedText)).toEqual([
        false,
        true,
        false,
      ]);
      expect(
        database.querySync<{ ocr_read: number }>(
          'SELECT ocr_read FROM earnings_imports ORDER BY ocr_read',
        ),
      ).toEqual([{ ocr_read: 0 }, { ocr_read: 0 }, { ocr_read: 1 }]);
    });

    it('adds the column to a database created without it, idempotently', async () => {
      await database.onModuleDestroy();
      const legacyPath = path.join(tempDir, 'legacy-ocr.db');
      const legacy = new Sqlite(legacyPath);
      legacy.exec(`CREATE TABLE earnings_imports (
        id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, file_name TEXT NOT NULL,
        source_type TEXT NOT NULL, file_sha256 TEXT NOT NULL, parser_id TEXT NOT NULL,
        parser_version TEXT NOT NULL, imported_at TEXT NOT NULL, UNIQUE (owner_id, file_sha256))`);
      legacy
        .prepare(
          `INSERT INTO earnings_imports VALUES ('old', 'o', 'a.pdf', 'PAYSLIP_PDF', ?, 'p', '1', 'now')`,
        )
        .run('d'.repeat(64));
      legacy.close();

      process.env.DATABASE_PATH = legacyPath;
      for (let round = 0; round < 2; round += 1) {
        const migrated = new DatabaseService();
        await migrated.onModuleInit();
        expect(
          migrated.querySync<{ ocr_read: number }>('SELECT ocr_read FROM earnings_imports'),
        ).toEqual([{ ocr_read: 0 }]);
        await migrated.onModuleDestroy();
      }
      database = new DatabaseService();
      process.env.DATABASE_PATH = path.join(tempDir, 'test.db');
    });
  });
});
