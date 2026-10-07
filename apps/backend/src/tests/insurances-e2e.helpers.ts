import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { randomBytes } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import type { InsuranceContractInput } from '@vaultfolio/api-contract';
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

export const INSURANCES_DOMAIN = 'insurances';

export interface InsurancesTestApp {
  app: INestApplication;
  mail: MailCatcher;
  database: DatabaseService;
  tempDir: string;
  get<T>(token: new (...args: never[]) => T): T;
  close(): Promise<void>;
}

/**
 * Boots the real app against a temp SQLite file with an `ENCRYPTION_KEY`. `key: null`
 * leaves it unset to exercise the fail-closed 503.
 */
export async function bootInsurancesApp(
  options: { key?: string | null; tempDir?: string } = {},
): Promise<InsurancesTestApp> {
  const tempDir =
    options.tempDir ?? fs.mkdtempSync(path.join(os.tmpdir(), 'vaultfolio-insurances-e2e-'));
  process.env.DATABASE_PATH = path.join(tempDir, 'test.db');
  process.env.BOOTSTRAP_ADMIN_EMAIL = ADMIN_EMAIL;
  process.env.BOOTSTRAP_ADMIN_PASSWORD = PASSWORD;
  process.env.APP_BASE_URL = 'https://vaultfolio.example.com';
  if (options.key === null) delete process.env.ENCRYPTION_KEY;
  else process.env.ENCRYPTION_KEY = options.key ?? randomBytes(32).toString('base64');

  const mail: MailCatcher = { sent: [], failNext: false };
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(MailerService)
    .useValue({
      send: (request: MailCatcher['sent'][number]) => {
        if (mail.failNext) {
          mail.failNext = false;
          return Promise.reject(new Error('smtp down'));
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
  return {
    app,
    mail,
    database: moduleRef.get(DatabaseService),
    tempDir,
    get: (token) => moduleRef.get(token),
    close: async () => {
      await app.close();
      for (const name of [
        'DATABASE_PATH',
        'BOOTSTRAP_ADMIN_EMAIL',
        'BOOTSTRAP_ADMIN_PASSWORD',
        'ENCRYPTION_KEY',
        'APP_BASE_URL',
      ])
        delete process.env[name];
    },
  };
}

export interface InsurancesSessions {
  admin: ReturnType<typeof client>;
  member: ReturnType<typeof client>;
  other: ReturnType<typeof client>;
  /** Entitled to insurances and earnings. */
  withEarnings: ReturnType<typeof client>;
  outsider: ReturnType<typeof client>;
  memberId: string;
  otherId: string;
  withEarningsId: string;
}

export async function signInSessions(t: InsurancesTestApp): Promise<InsurancesSessions> {
  const memberId = await createMember(t.database, 'member@example.com', [INSURANCES_DOMAIN]);
  const otherId = await createMember(t.database, 'other@example.com', [INSURANCES_DOMAIN]);
  const withEarningsId = await createMember(t.database, 'earn@example.com', [
    INSURANCES_DOMAIN,
    'earnings',
  ]);
  await createMember(t.database, 'outsider@example.com', ['holdings']);
  return {
    admin: client(t.app, await signIn(t.app, ADMIN_EMAIL)),
    member: client(t.app, await signIn(t.app, 'member@example.com')),
    other: client(t.app, await signIn(t.app, 'other@example.com')),
    withEarnings: client(t.app, await signIn(t.app, 'earn@example.com')),
    outsider: client(t.app, await signIn(t.app, 'outsider@example.com')),
    memberId,
    otherId,
    withEarningsId,
  };
}

export const SECRET_NAME = 'Haftpflicht Familie Beispiel';
export const SECRET_NUMBER = 'HV-4711-0815';

export function contractPayload(
  over: Partial<InsuranceContractInput> = {},
): InsuranceContractInput {
  return {
    type: 'PRIVATE_LIABILITY',
    name: SECRET_NAME,
    insurer: 'Beispiel Versicherung AG',
    contractNumber: SECRET_NUMBER,
    status: 'ACTIVE',
    startDate: '2025-01-01',
    premium: '96.00',
    interval: 'YEARLY',
    paymentMonth: 3,
    cancellation: { autoRenew: true, period: { value: 3, unit: 'MONTHS' } },
    reminderEnabled: true,
    ...over,
  };
}

export const settingsPayload = (over: Record<string, unknown> = {}) => ({
  profile: {
    ownsProperty: false,
    ownsCar: false,
    hasChildren: false,
    hasPets: false,
    travelsAbroad: false,
    employment: 'EMPLOYED',
  },
  reminders: { enabled: true, leadDays: 30 },
  dismissedRequirements: [],
  includeSocial: true,
  ...over,
});
