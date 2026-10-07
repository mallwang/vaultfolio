import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { randomBytes } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import type { WealthEntry, WealthSnapshotInput } from '@vaultfolio/api-contract';
import { AppModule } from '../app/app.module';
import { configureBodyParsers } from '../app/body-parsers';
import { DatabaseService } from '../database/database.service';
import { MailerService } from '../mail/mailer.service';
import {
  ADMIN_EMAIL,
  type MailCatcher,
  PASSWORD,
  client,
  createMember,
  signIn,
} from './earnings-e2e.helpers';

export { ADMIN_EMAIL, PASSWORD, client, createMember, signIn };

export const WEALTH_DOMAIN = 'historic-wealth-development';

export interface WealthTestApp {
  app: INestApplication;
  mail: MailCatcher;
  database: DatabaseService;
  tempDir: string;
  close(): Promise<void>;
}

/**
 * Boots the real app (explicit body parsers as in main.ts) against a temp SQLite file with a
 * `ENCRYPTION_KEY`. `key: null` leaves it unset to exercise the fail-closed 503.
 */
export async function bootWealthApp(
  options: { key?: string | null; tempDir?: string } = {},
): Promise<WealthTestApp> {
  const tempDir =
    options.tempDir ?? fs.mkdtempSync(path.join(os.tmpdir(), 'vaultfolio-wealth-e2e-'));
  process.env.DATABASE_PATH = path.join(tempDir, 'test.db');
  process.env.BOOTSTRAP_ADMIN_EMAIL = ADMIN_EMAIL;
  process.env.BOOTSTRAP_ADMIN_PASSWORD = PASSWORD;
  if (options.key === null) delete process.env.ENCRYPTION_KEY;
  else process.env.ENCRYPTION_KEY = options.key ?? randomBytes(32).toString('base64');

  const mail: MailCatcher = { sent: [], failNext: false };
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(MailerService)
    .useValue({
      send: (request: MailCatcher['sent'][number]) => {
        mail.sent.push(request);
        return Promise.resolve();
      },
    })
    .compile();
  const app = moduleRef.createNestApplication({ bodyParser: false });
  configureBodyParsers(app);
  app.use(cookieParser());
  await app.init();
  return {
    app,
    mail,
    database: moduleRef.get(DatabaseService),
    tempDir,
    close: async () => {
      await app.close();
      delete process.env.DATABASE_PATH;
      delete process.env.BOOTSTRAP_ADMIN_EMAIL;
      delete process.env.BOOTSTRAP_ADMIN_PASSWORD;
      delete process.env.ENCRYPTION_KEY;
    },
  };
}

export interface WealthSessions {
  admin: ReturnType<typeof client>;
  /** Member entitled to the wealth domain. */
  member: ReturnType<typeof client>;
  /** A second entitled member — for owner-isolation checks. */
  other: ReturnType<typeof client>;
  /** Member without the wealth domain scope. */
  outsider: ReturnType<typeof client>;
  memberId: string;
  otherId: string;
}

/** Signs in the bootstrap admin and creates three members (two entitled, one not). */
export async function signInSessions(t: WealthTestApp): Promise<WealthSessions> {
  const memberId = await createMember(t.database, 'member@example.com', [WEALTH_DOMAIN]);
  const otherId = await createMember(t.database, 'other@example.com', [WEALTH_DOMAIN]);
  await createMember(t.database, 'outsider@example.com', ['holdings']);
  return {
    admin: client(t.app, await signIn(t.app, ADMIN_EMAIL)),
    member: client(t.app, await signIn(t.app, 'member@example.com')),
    other: client(t.app, await signIn(t.app, 'other@example.com')),
    outsider: client(t.app, await signIn(t.app, 'outsider@example.com')),
    memberId,
    otherId,
  };
}

// ---------------------------------------------------------------- payload builders (invented data)

export const SECRET_NAME = 'Whisky-Sammlung Fasskauf';
export const SECRET_AMOUNT = '48213.77';

export function entry(over: Partial<WealthEntry> = {}): WealthEntry {
  return {
    side: 'ASSET',
    class: { standard: 'bankBalances' },
    name: 'Girokonto',
    amount: '2500.00',
    ...over,
  };
}

export function snapshotPayload(over: Partial<WealthSnapshotInput> = {}): WealthSnapshotInput {
  return {
    snapshotDate: '2026-03-31',
    note: 'Quartalsende',
    entries: [
      entry(),
      entry({ class: { custom: 'Whisky' }, name: SECRET_NAME, amount: SECRET_AMOUNT }),
      entry({
        side: 'LIABILITY',
        class: { standard: 'mortgage' },
        name: 'Baudarlehen',
        amount: '150000.00',
      }),
    ],
    ...over,
  };
}
