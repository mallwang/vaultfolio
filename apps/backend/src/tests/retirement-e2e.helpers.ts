import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { randomBytes } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import type { RetirementRecordInput } from '@vaultfolio/api-contract';
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

export interface RetirementTestApp {
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
export async function bootRetirementApp(
  options: { key?: string | null; tempDir?: string } = {},
): Promise<RetirementTestApp> {
  const tempDir =
    options.tempDir ?? fs.mkdtempSync(path.join(os.tmpdir(), 'vaultfolio-retirement-e2e-'));
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

export interface RetirementSessions {
  admin: ReturnType<typeof client>;
  /** Member entitled to `retirement`. */
  member: ReturnType<typeof client>;
  /** A second entitled member — for owner-isolation checks. */
  other: ReturnType<typeof client>;
  /** Member without the `retirement` domain scope. */
  outsider: ReturnType<typeof client>;
  memberId: string;
  otherId: string;
}

/** Signs in the bootstrap admin and creates three members (two entitled, one not). */
export async function signInSessions(t: RetirementTestApp): Promise<RetirementSessions> {
  const memberId = await createMember(t.database, 'member@example.com', ['retirement']);
  const otherId = await createMember(t.database, 'other@example.com', ['retirement']);
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

const IMPORT_INFO = { parserId: 'private-statement', parserVersion: '1', ocrRead: false };

export function statutoryPayload(over: Partial<RetirementRecordInput> = {}): RetirementRecordInput {
  return {
    contractType: 'STATUTORY_PENSION',
    origin: 'MANUAL',
    status: 'ACTIVE',
    statementDate: '2026-05-01',
    payoutStart: '2056-03-01',
    identifier: '12 345678 A 123',
    figures: {
      accruedMonthly: '1200.00',
      projectedMonthly: '2000.00',
      projectedAt1Pct: '2400.00',
      projectedAt2Pct: '2900.00',
      earningsPoints: '30.0000',
      currentPensionValue: '40.00',
    },
    ...over,
  };
}

export function occupationalPayload(
  over: Partial<RetirementRecordInput> = {},
): RetirementRecordInput {
  return {
    contractType: 'DIRECT_INSURANCE',
    origin: 'MANUAL',
    status: 'ACTIVE',
    providerLabel: 'Muster Arbeitgeber GmbH',
    statementDate: '2026-04-01',
    payoutStart: '2052-07-01',
    identifier: 'DV-4711',
    figures: {
      guaranteedMonthly: '200.00',
      expectedMonthly: '280.00',
      contributionMonthly: '100.00',
      employerContributionMonthly: '60.00',
    },
    ...over,
  };
}

export function riesterPayload(over: Partial<RetirementRecordInput> = {}): RetirementRecordInput {
  return {
    contractType: 'RIESTER',
    origin: 'MANUAL',
    status: 'ACTIVE',
    providerLabel: 'Muster Versicherung',
    statementDate: '2026-04-01',
    payoutStart: '2050-01-01',
    identifier: 'RV-123456',
    figures: {
      guaranteedMonthly: '100.00',
      expectedMonthly: '150.00',
      contributionMonthly: '60.00',
      subsidiesYearly: '175.00',
    },
    ...over,
  };
}

export function depotPayload(over: Partial<RetirementRecordInput> = {}): RetirementRecordInput {
  return {
    contractType: 'ALTERSVORSORGEDEPOT',
    origin: 'MANUAL',
    status: 'ACTIVE',
    providerLabel: 'Muster Depot AG',
    statementDate: '2026-04-01',
    figures: { currentValue: '5000.00', expectedMonthly: '40.00', contributionMonthly: '50.00' },
    ...over,
  };
}

/** An imported Riester statement (consistent scenarios and contribution sums). */
export function importedRiesterPayload(
  over: Partial<RetirementRecordInput> = {},
): RetirementRecordInput {
  return {
    contractType: 'RIESTER',
    origin: 'IMPORTED',
    status: 'ACTIVE',
    providerLabel: 'Muster Versicherung',
    statementDate: '2026-04-01',
    payoutStart: '2050-01-01',
    identifier: 'RV-123456',
    figures: {
      guaranteedMonthly: '100.00',
      expectedMonthly: '150.00',
      scenarioMonthly: { '0': '110.00', '3': '150.00', '6': '200.00', '9': '260.00' },
      contributionsMain: '9000.00',
      contributionsExtra: '1000.00',
      contributionsPaid: '10000.00',
    },
    supplement: { contributionMonthly: '60.00', expectedScenario: '3' },
    import: IMPORT_INFO,
    ...over,
  };
}

/** An imported DRV letter (points × value = accrued, ordered projections). */
export function importedStatutoryPayload(
  over: Partial<RetirementRecordInput> = {},
): RetirementRecordInput {
  return {
    ...statutoryPayload(),
    origin: 'IMPORTED',
    import: { parserId: 'drv-renteninformation', parserVersion: '1', ocrRead: true },
    ...over,
  };
}
