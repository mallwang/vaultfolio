import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as argon2 from 'argon2';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import type { EarningsImportFile, EarningsPayRecordInput } from '@vaultfolio/api-contract';
import {
  applyCorrection,
  collectCheckFailures,
  editableKeys,
  parseDocument,
  sub,
  textDocument,
  toImportFile,
} from '@vaultfolio/earnings';
import { AppModule } from '../app/app.module';
import { configureBodyParsers } from '../app/body-parsers';
import { DatabaseService } from '../database/database.service';
import { MailerService } from '../mail/mailer.service';

export const ADMIN_EMAIL = 'admin@example.com';
// eslint-disable-next-line sonarjs/no-hardcoded-passwords -- synthetic credential of a throw-away e2e database
export const PASSWORD = 'a-valid-8-char-password';

/** Recording stand-in for the SMTP mailer: tests assert on `sent`, `failNext` simulates a delivery failure. */
export interface MailCatcher {
  sent: { to: string; subject: string; html: string; text: string }[];
  failNext: boolean;
}

export interface EarningsTestApp {
  app: INestApplication;
  mail: MailCatcher;
  database: DatabaseService;
  tempDir: string;
  close(): Promise<void>;
}

/** Boots the real app (explicit body parsers as in main.ts) against a temp SQLite file. */
export async function bootEarningsApp(
  options: { key?: string | null; tempDir?: string } = {},
): Promise<EarningsTestApp> {
  const tempDir =
    options.tempDir ?? fs.mkdtempSync(path.join(os.tmpdir(), 'vaultfolio-earnings-e2e-'));
  process.env.DATABASE_PATH = path.join(tempDir, 'test.db');
  process.env.BOOTSTRAP_ADMIN_EMAIL = ADMIN_EMAIL;
  process.env.BOOTSTRAP_ADMIN_PASSWORD = PASSWORD;
  if (options.key === null) delete process.env.EARNINGS_ENCRYPTION_KEY;
  else process.env.EARNINGS_ENCRYPTION_KEY = options.key ?? randomBytes(32).toString('base64');

  const mail: MailCatcher = { sent: [], failNext: false };
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(MailerService)
    .useValue({
      send: (request: MailCatcher['sent'][number]) => {
        if (mail.failNext) {
          mail.failNext = false;
          return Promise.reject(new Error('simulated delivery failure'));
        }
        mail.sent.push(request);
        return Promise.resolve();
      },
    })
    .compile();
  const app = moduleRef.createNestApplication({ bodyParser: false });
  configureBodyParsers(app);
  app.use(cookieParser());
  await app.init();
  const database = moduleRef.get(DatabaseService);
  return {
    app,
    mail,
    database,
    tempDir,
    close: async () => {
      await app.close();
      delete process.env.DATABASE_PATH;
      delete process.env.BOOTSTRAP_ADMIN_EMAIL;
      delete process.env.BOOTSTRAP_ADMIN_PASSWORD;
      delete process.env.EARNINGS_ENCRYPTION_KEY;
    },
  };
}

export async function createMember(
  database: DatabaseService,
  email: string,
  domainScopes: string[],
): Promise<string> {
  const id = randomUUID();
  await database.query(
    `INSERT INTO users (id, email, display_name, password_hash, role, domain_scopes) VALUES ($1, $2, $3, $4, 'MEMBER', $5)`,
    [id, email, email, await argon2.hash(PASSWORD), JSON.stringify(domainScopes)],
  );
  return id;
}

export async function signIn(app: INestApplication, email: string): Promise<string> {
  const response = await request(app.getHttpServer())
    .post('/auth/sign-in')
    .send({ email, password: PASSWORD });
  const setCookie = response.headers['set-cookie'] as unknown as string[];
  return setCookie[0].split(';')[0];
}

export function client(app: INestApplication, cookie: string) {
  const agent = () => request(app.getHttpServer());
  return {
    get: (url: string) => agent().get(url).set('Cookie', cookie),
    post: (url: string) => agent().post(url).set('Cookie', cookie),
    put: (url: string) => agent().put(url).set('Cookie', cookie),
    patch: (url: string) => agent().patch(url).set('Cookie', cookie),
    del: (url: string) => agent().delete(url).set('Cookie', cookie),
  };
}

export function sha(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

/** Parses synthetic page lines with the real parser and builds the whitelisted import body. */
export function importFileFromPages(
  pages: string[][],
  meta: { clientFileId: string; fileName: string; shaSeed?: string },
): EarningsImportFile {
  const parsed = parseDocument(textDocument(pages));
  if (!parsed.ok) throw new Error(`fixture does not parse: ${parsed.error.code}`);
  return toImportFile(parsed, {
    clientFileId: meta.clientFileId,
    fileName: meta.fileName,
    sourceType: parsed.documentType === 'CERTIFICATE' ? 'CERTIFICATE_PDF' : 'PAYSLIP_PDF',
    fileSha256: sha(meta.shaSeed ?? JSON.stringify(pages)),
    parserId: parsed.parserId as string,
    parserVersion: parsed.parserVersion as string,
  });
}

/**
 * A payslip the parser rejected with a NET difference of `misread` (the wage tax was read
 * `misread` too high), fixed the way a user does it in the preview: the figure is replaced and
 * its name is listed in `corrected` (FR-012a).
 */
export function correctedImportFile(
  pages: string[][],
  misread: string,
  meta: { clientFileId: string; fileName: string },
): EarningsImportFile {
  const parsed = parseDocument(textDocument(pages));
  if (parsed.ok || !parsed.partial) throw new Error('fixture is expected to fail a check');
  const { records, certificates } = parsed.partial;
  const editable = editableKeys(collectCheckFailures(records));
  const fixed = applyCorrection(
    records,
    { recordIndex: 0, key: 'wageTax', value: sub(records[0].amounts.wageTax, misread) },
    editable,
  );
  if (!fixed) throw new Error('wageTax is not editable');
  return toImportFile(
    { records: fixed, certificates },
    {
      ...meta,
      sourceType: 'PAYSLIP_PDF',
      fileSha256: sha(JSON.stringify(pages)),
      parserId: parsed.parserId as string,
      parserVersion: parsed.parserVersion as string,
    },
  );
}

/** A balanced regular record with invented figures (gross 5000.00 → net 3180.00). */
export function balancedRecord(
  period: string,
  employer = 'Brightline Software GmbH',
): EarningsPayRecordInput {
  return {
    employer,
    period,
    issued: period,
    kind: 'REGULAR',
    seq: 1,
    amounts: {
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
    },
  };
}

/** Consecutive periods `count` months starting at `from` (`YYYY-MM`). */
export function periods(from: string, count: number): string[] {
  const [y, m] = from.split('-').map(Number);
  return Array.from({ length: count }, (_, i) => {
    const idx = y * 12 + (m - 1) + i;
    return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, '0')}`;
  });
}
