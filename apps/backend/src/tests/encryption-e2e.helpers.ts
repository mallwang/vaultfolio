import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { randomBytes } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { AppModule } from '../app/app.module';
import { configureBodyParsers } from '../app/body-parsers';
import { DatabaseService } from '../database/database.service';
import { DOMAIN_ENCRYPTION, rowAad } from '../encryption/domain-encryption.registry';
import { MailerService } from '../mail/mailer.service';
import { encryptField } from '../shared/field-crypto';
import { ADMIN_EMAIL, PASSWORD, client, signIn } from './earnings-e2e.helpers';

export { ADMIN_EMAIL, client, signIn };

export const newKey = (): string => randomBytes(32).toString('base64');

export function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'vaultfolio-encryption-e2e-'));
}

function setEnv(name: string, value: string | null | undefined): void {
  if (value) process.env[name] = value;
  else delete process.env[name];
}

function applyKeys(options: { key?: string | null; previous?: string }): void {
  setEnv('ENCRYPTION_KEY', options.key);
  setEnv('ENCRYPTION_KEY_PREVIOUS', options.previous);
}

function clearKeys(): void {
  applyKeys({});
}

export interface EncryptionTestApp {
  app: INestApplication;
  database: DatabaseService;
  close(): Promise<void>;
}

/** Boots the real app on `tempDir`'s SQLite file with the given master (and previous) key. */
export async function bootEncryptionApp(options: {
  tempDir: string;
  key?: string | null;
  previous?: string;
}): Promise<EncryptionTestApp> {
  process.env.DATABASE_PATH = path.join(options.tempDir, 'test.db');
  process.env.BOOTSTRAP_ADMIN_EMAIL = ADMIN_EMAIL;
  process.env.BOOTSTRAP_ADMIN_PASSWORD = PASSWORD;
  applyKeys(options);
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(MailerService)
    .useValue({ send: () => Promise.resolve() })
    .compile();
  const app = moduleRef.createNestApplication({ bodyParser: false });
  configureBodyParsers(app);
  app.use(cookieParser());
  await app.init();
  return {
    app,
    database: moduleRef.get(DatabaseService),
    close: async () => {
      await app.close();
      delete process.env.DATABASE_PATH;
      delete process.env.BOOTSTRAP_ADMIN_EMAIL;
      delete process.env.BOOTSTRAP_ADMIN_PASSWORD;
      clearKeys();
    },
  };
}

export interface SeededRow {
  table: string;
  id: string;
  ownerId: string;
  marker: string;
}

const NOW = '2026-10-01T10:00:00.000Z';

/** Insert statements (without ciphertext) for the encrypted tables; `$1` id, `$2` owner, `$3` ciphertext. */
const FIXTURE_SQL: Record<string, string> = {
  earnings_records: `INSERT INTO earnings_records (id, owner_id, import_id, employer_id, period, issued, kind, seq, amounts_enc, key_version, created_at)
    VALUES ($1, $2, 'i', 'e', '2026-01', '2026-01', 'REGULAR', 1, $3, 1, '${NOW}')`,
  earnings_certificates: `INSERT INTO earnings_certificates (id, owner_id, import_id, employer_id, year, amounts_enc, key_version, created_at)
    VALUES ($1, $2, 'i', 'e', 2025, $3, 1, '${NOW}')`,
  retirement_records: `INSERT INTO retirement_records (id, owner_id, pillar, contract_type, origin, status, statement_date, payload_enc, key_version, created_at, updated_at)
    VALUES ($1, $2, 'STATUTORY', 'STATUTORY_PENSION', 'MANUAL', 'ACTIVE', '2026-01-01', $3, 1, '${NOW}', '${NOW}')`,
  wealth_snapshots: `INSERT INTO wealth_snapshots (id, owner_id, snapshot_date, payload_enc, key_version, created_at, updated_at)
    VALUES ($1, $2, '2026-01-01', $3, 1, '${NOW}', '${NOW}')`,
  wealth_settings: `INSERT INTO wealth_settings (owner_id, payload_enc, key_version, updated_at)
    VALUES ($2, $3, 1, '${NOW}')`,
  insurance_contracts: `INSERT INTO insurance_contracts (id, owner_id, payload_enc, key_version, created_at, updated_at)
    VALUES ($1, $2, $3, 1, '${NOW}', '${NOW}')`,
  holdings: `INSERT INTO holdings (id, owner_id, payload_enc, key_version, created_at, updated_at)
    VALUES ($1, $2, $3, 1, '${NOW}', '${NOW}')`,
  insurance_settings: `INSERT INTO insurance_settings (owner_id, payload_enc, key_version, updated_at)
    VALUES ($2, $3, 1, '${NOW}')`,
  account_overview_entries: `INSERT INTO account_overview_entries (id, owner_id, payload_enc, key_version, created_at, updated_at)
    VALUES ($1, $2, $3, 1, '${NOW}', '${NOW}')`,
  feedback_submissions: `INSERT INTO feedback_submissions (id, owner_id, category, language, payload_enc, key_version, created_at)
    VALUES ($1, $2, 'other', 'en', $3, 1, '${NOW}')`,
};

/**
 * Pre-feature database: creates the schema, then writes one legacy `v1` row (encrypted directly with
 * the domain's master key) into each of the encrypted tables. Returns what was written.
 */
export async function seedLegacyDatabase(tempDir: string, masterKey: string): Promise<SeededRow[]> {
  process.env.DATABASE_PATH = path.join(tempDir, 'test.db');
  process.env.BOOTSTRAP_ADMIN_EMAIL = ADMIN_EMAIL;
  process.env.BOOTSTRAP_ADMIN_PASSWORD = PASSWORD;
  const database = new DatabaseService();
  await database.onModuleInit();
  const rows: SeededRow[] = [];
  for (const domain of DOMAIN_ENCRYPTION) {
    const key = Buffer.from(masterKey, 'base64');
    for (const t of domain.tables) {
      const ownerId = `owner-${t.table}`;
      const id = t.idColumn === 'owner_id' ? ownerId : `row-${t.table}`;
      const marker = `secret-${t.table}`;
      const ciphertext = encryptField(key, rowAad(t.table, id, ownerId), { marker });
      database.querySync(FIXTURE_SQL[t.table], [id, ownerId, ciphertext]);
      rows.push({ table: t.table, id, ownerId, marker });
    }
  }
  await database.onModuleDestroy();
  delete process.env.DATABASE_PATH;
  delete process.env.BOOTSTRAP_ADMIN_EMAIL;
  delete process.env.BOOTSTRAP_ADMIN_PASSWORD;
  return rows;
}
