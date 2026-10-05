#!/usr/bin/env node
/**
 * Generates a synthetic Altersvorsorge dataset for limit testing and loads it through the REST API
 * (document import is client-side, so records are POSTed directly): one statutory pension plus 80
 * occupational/private contracts across every contract type, MANUAL and IMPORTED (with
 * supplements), statuses ACTIVE/PAID_UP/IN_PAYOUT, fresh / outdated / very old statements, 80-char
 * provider labels, 40-char identifiers, early/same/later payout starts and zero/omitted figures.
 * Imported records satisfy the server-side plausibility checks. All names and figures are INVENTED;
 * the output is deterministic.
 *
 *   node tools/retirement/seed-retirement-testset.mjs --email <e> --password <p> [--base http://localhost:3000]
 *        [--profile realistic] # 7 realistic contracts instead (Member demo account)
 *        [--out records.json]   # write the JSON only, no upload
 *        [--replace]            # DELETE /retirement first (otherwise refuses on a non-empty account)
 */
import { writeFileSync } from 'node:fs';

const args = Object.fromEntries(
  process.argv.slice(2).flatMap((a, i, all) => {
    if (!a.startsWith('--')) return [];
    const next = all[i + 1];
    return [[a.slice(2), next && !next.startsWith('--') ? next : true]];
  }),
);

let seed = 20261004;
function rnd() {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const between = (a, b) => a + (b - a) * rnd();
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const money = (n) => Math.max(0, n).toFixed(2);

const TODAY = new Date('2026-10-04T00:00:00Z');
const dateMonthsAgo = (months) => {
  const d = new Date(
    Date.UTC(TODAY.getUTCFullYear(), TODAY.getUTCMonth() - months, 1 + Math.floor(rnd() * 27)),
  );
  return (d > TODAY ? TODAY : d).toISOString().slice(0, 10);
};
const iso = (y, m, d = 1) => new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10);

const PROVIDERS = [
  'Allianz Lebensversicherung',
  'Hanseatische Vorsorge AG',
  'Rheinland Pensionskasse VVaG',
  'Süddeutsche Rentenversicherung a.G.',
  'Nordlicht Versicherungsgruppe',
  'Alpenland Lebensversicherung',
  'Mittelstands-Pensionsfonds',
  'Kurpfalz Vorsorge',
  'Brightline Altersvorsorge GmbH',
  'Stadtwerke Musterstadt Zusatzversorgung',
];
const LONG_PROVIDER =
  'Gemeinschaftliche Versorgungseinrichtung der Mitteldeutschen Bildungs- und Forschungsgesellschaft'.slice(
    0,
    80,
  );
const LONG_IDENTIFIER = 'VS-1977/0815-4711/ABCDEFGHIJ-0123456789'.slice(0, 40);

const OCC_TYPES = [
  'DIRECT_INSURANCE',
  'PENSIONSKASSE',
  'DIREKTZUSAGE',
  'UNTERSTUETZUNGSKASSE',
  'PENSIONSFONDS',
];
const PARSER = {
  PENSION: ['private-statement', '1.0.0'],
  CAPITAL_ACCOUNT: ['capital-account-statement', '1.0.0'],
};

const records = [];

// ---- statutory (exactly one). Points × pension value = accrued; ordered projections.
{
  const points = 38.4217;
  const value = 40.79;
  const accrued = Math.round(points * value * 100) / 100;
  records.push({
    contractType: 'STATUTORY_PENSION',
    origin: 'IMPORTED',
    status: 'ACTIVE',
    statementDate: dateMonthsAgo(3),
    payoutStart: iso(2047, 3),
    figures: {
      dataPeriodFrom: iso(1998, 8),
      dataPeriodTo: iso(2025, 12, 31),
      earningsPoints: points.toFixed(4),
      currentPensionValue: value.toFixed(2),
      accruedMonthly: money(accrued),
      fullDisabilityMonthly: money(accrued * 1.4),
      projectedMonthly: money(accrued * 1.75),
      projectedAt1Pct: money(accrued * 1.95),
      projectedAt2Pct: money(accrued * 2.15),
      contributionsOwn: money(78000),
      contributionsEmployer: money(78000),
      contributionsPublic: money(3500),
    },
    import: { parserId: 'drv-renteninformation', parserVersion: '1.0.0', ocrRead: false },
  });
}

function statementDate(i) {
  if (i % 11 === 0) return dateMonthsAgo(Math.floor(between(30, 90))); // very old
  if (i % 4 === 0) return dateMonthsAgo(Math.floor(between(13, 26))); // outdated
  return dateMonthsAgo(Math.floor(between(0, 11))); // current
}
function payoutStart(i, base) {
  // earlier / same (2047-03) / later than the statutory pension; some already in payout
  if (base === 'IN_PAYOUT') return iso(2024 + (i % 2), 1 + (i % 12));
  return pick([
    iso(2043, 1 + (i % 12)),
    iso(2047, 3),
    iso(2047, 3),
    iso(2049, 1 + (i % 12)),
    iso(2052, 7),
  ]);
}

function pensionFigures(i, imported) {
  const g = between(40, 650);
  const s0 = g * between(1.0, 1.25);
  const s3 = s0 * between(1.15, 1.4);
  const s6 = s3 * between(1.2, 1.45);
  const s9 = s6 * between(1.25, 1.5);
  const main = between(8000, 90000);
  const extra = rnd() < 0.4 ? between(500, 9000) : 0;
  const f = {
    guaranteedMonthly: money(g),
    guaranteedCapital: money(g * between(180, 260)),
    scenarioMonthly: { 0: money(s0), 3: money(s3), 6: money(s6), 9: money(s9) },
    currentValue: money((main + extra) * between(0.9, 1.3)),
    contributionsMain: money(main),
    contributionsExtra: money(extra),
    contributionsPaid: money(Number(money(main)) + Number(money(extra))),
    surrenderValue: money(main * between(0.7, 1.05)),
    deathBenefit: money(main * between(0.9, 1.4)),
    guaranteePeriodYears: pick([0, 5, 10, 15, 20]),
  };
  if (!imported) {
    f.expectedMonthly = money(Math.max(g, between(g, s6)));
    f.contributionMonthly = money(between(25, 450));
    if (rnd() < 0.5) f.capitalPayout = money(g * between(200, 300));
  }
  return f;
}

function capitalFigures(i, imported) {
  const opening = between(5000, 180000);
  const rate = pick([0.9, 1.25, 1.75, 2.25, 2.75, 3.5]);
  const interest = Math.round(opening * rate) / 100;
  const contrib = Math.round(between(600, 7200) * 100) / 100;
  const f = {
    openingBalance: money(opening),
    interestCredit: money(interest),
    annualContribution: money(contrib),
    accountBalance: money(opening + interest + contrib),
    guaranteedInterestRate: rate.toFixed(4),
  };
  if (rnd() < 0.5) f.finalBonus = money(between(0, 4000));
  if (!imported) {
    f.expectedMonthly = money(between(30, 500));
    f.contributionMonthly = money(contrib / 12);
    f.employerContributionMonthly = money(between(20, 250));
  }
  return f;
}

const TYPE_PLAN = [
  ...Array(18).fill('RIESTER'),
  ...Array(16).fill('PRIVATE_PENSION_INSURANCE'),
  ...Array(8).fill('ALTERSVORSORGEDEPOT'),
  ...Array(12).fill('CAPITAL_ACCOUNT'),
  ...Array(26).fill('OCC'),
];

TYPE_PLAN.forEach((planned, i) => {
  const type = planned === 'OCC' ? OCC_TYPES[i % OCC_TYPES.length] : planned;
  // roughly 45 % imported where an import parser exists (private pensions + capital accounts)
  const importable =
    type !== 'ALTERSVORSORGEDEPOT' &&
    (type === 'CAPITAL_ACCOUNT' ||
      type === 'RIESTER' ||
      type === 'PRIVATE_PENSION_INSURANCE' ||
      OCC_TYPES.includes(type));
  const imported = importable && rnd() < 0.45;
  const status = rnd() < 0.12 ? 'PAID_UP' : rnd() < 0.08 ? 'IN_PAYOUT' : 'ACTIVE';
  const family =
    type === 'CAPITAL_ACCOUNT'
      ? 'CAPITAL_ACCOUNT'
      : type === 'ALTERSVORSORGEDEPOT'
        ? 'DEPOT'
        : 'PENSION';

  let figures;
  if (family === 'CAPITAL_ACCOUNT') figures = capitalFigures(i, imported);
  else if (family === 'DEPOT')
    figures = {
      currentValue: money(between(0, 60000)),
      expectedMonthly: money(between(40, 400)),
      contributionMonthly: money(between(25, 300)),
    };
  else figures = pensionFigures(i, imported);

  const record = {
    contractType: type,
    origin: imported ? 'IMPORTED' : 'MANUAL',
    status,
    providerLabel:
      i === 3
        ? LONG_PROVIDER
        : `${PROVIDERS[i % PROVIDERS.length]}${i >= PROVIDERS.length ? ` – Vertrag ${i + 1}` : ''}`.slice(
            0,
            80,
          ),
    statementDate: statementDate(i),
    figures,
  };
  if (rnd() < 0.85) record.payoutStart = payoutStart(i, status);
  // payoutStart must lie within [statementDate − 1y, statementDate + 80y]
  if (record.payoutStart && record.payoutStart <= record.statementDate)
    record.payoutStart = iso(Number(record.statementDate.slice(0, 4)) + 1, 1);
  if (i === 5) record.identifier = LONG_IDENTIFIER;
  else if (rnd() < 0.5)
    record.identifier = `VS-${String(100000 + i * 137).slice(0, 6)}/${(i % 9) + 1}`;

  if (imported) {
    const [parserId, parserVersion] =
      family === 'CAPITAL_ACCOUNT' ? PARSER.CAPITAL_ACCOUNT : PARSER.PENSION;
    record.import = { parserId, parserVersion, ocrRead: i % 5 === 0 };
    const supplement = {};
    if (family === 'CAPITAL_ACCOUNT') {
      if (rnd() < 0.8) supplement.contributionMonthly = money(between(50, 600));
      if (rnd() < 0.5) supplement.employerContributionMonthly = money(between(20, 250));
      if (rnd() < 0.6) supplement.expectedMonthly = money(between(30, 450));
    } else {
      if (rnd() < 0.8) supplement.contributionMonthly = money(between(25, 450));
      if (type === 'RIESTER' && rnd() < 0.7) supplement.subsidiesYearly = money(between(154, 475));
      if (OCC_TYPES.includes(type) && rnd() < 0.5)
        supplement.employerContributionMonthly = money(between(20, 250));
      if (rnd() < 0.7) supplement.expectedScenario = pick(['0', '3', '6', '9']);
    }
    if (Object.keys(supplement).length) record.supplement = supplement;
  }
  records.push(record);
});

/** Realistic demo set: statutory pension plus six plausible contracts. */
function demoRecords() {
  const recent = (months) => dateMonthsAgo(months);
  return [
    {
      contractType: 'STATUTORY_PENSION',
      origin: 'IMPORTED',
      status: 'ACTIVE',
      statementDate: recent(2),
      payoutStart: iso(2051, 6),
      figures: {
        dataPeriodFrom: iso(2008, 9),
        dataPeriodTo: iso(2025, 12, 31),
        earningsPoints: '24.0000',
        currentPensionValue: '40.79',
        accruedMonthly: '978.96',
        fullDisabilityMonthly: '1250.00',
        projectedMonthly: '1650.00',
        projectedAt1Pct: '1800.00',
        projectedAt2Pct: '1960.00',
        contributionsOwn: money(52000),
        contributionsEmployer: money(52000),
        contributionsPublic: money(0),
      },
      import: { parserId: 'drv-renteninformation', parserVersion: '1.0.0', ocrRead: false },
    },
    {
      contractType: 'RIESTER',
      origin: 'IMPORTED',
      status: 'ACTIVE',
      providerLabel: 'Hanseatische Vorsorge AG',
      statementDate: recent(4),
      payoutStart: iso(2051, 6),
      identifier: 'RS-2012/04711',
      figures: {
        guaranteedMonthly: '142.30',
        scenarioMonthly: { 0: '151.00', 3: '214.00', 6: '298.00', 9: '412.00' },
        currentValue: '21840.00',
        contributionsMain: '17200.00',
        contributionsExtra: '0.00',
        contributionsPaid: '17200.00',
        surrenderValue: '19950.00',
        guaranteePeriodYears: 10,
      },
      supplement: {
        contributionMonthly: '160.00',
        subsidiesYearly: '175.00',
        expectedScenario: '3',
      },
      import: { parserId: 'private-statement', parserVersion: '1.0.0', ocrRead: false },
    },
    {
      contractType: 'PRIVATE_PENSION_INSURANCE',
      origin: 'MANUAL',
      status: 'ACTIVE',
      providerLabel: 'Süddeutsche Rentenversicherung a.G.',
      statementDate: recent(7),
      payoutStart: iso(2051, 6),
      figures: {
        guaranteedMonthly: '96.00',
        expectedMonthly: '188.00',
        currentValue: '14300.00',
        contributionMonthly: '120.00',
      },
    },
    {
      contractType: 'DIRECT_INSURANCE',
      origin: 'MANUAL',
      status: 'ACTIVE',
      providerLabel: 'Allianz Lebensversicherung',
      statementDate: recent(5),
      payoutStart: iso(2051, 6),
      figures: {
        guaranteedMonthly: '88.50',
        expectedMonthly: '161.00',
        currentValue: '11700.00',
        contributionMonthly: '150.00',
        employerContributionMonthly: '60.00',
      },
    },
    {
      contractType: 'CAPITAL_ACCOUNT',
      origin: 'IMPORTED',
      status: 'ACTIVE',
      providerLabel: 'Brightline Software GmbH',
      statementDate: recent(3),
      figures: {
        openingBalance: '42000.00',
        interestCredit: '945.00',
        annualContribution: '2400.00',
        accountBalance: '45345.00',
        guaranteedInterestRate: '2.2500',
      },
      supplement: {
        contributionMonthly: '200.00',
        employerContributionMonthly: '100.00',
        expectedMonthly: '210.00',
      },
      import: { parserId: 'capital-account-statement', parserVersion: '1.0.0', ocrRead: false },
    },
    {
      contractType: 'ALTERSVORSORGEDEPOT',
      origin: 'MANUAL',
      status: 'ACTIVE',
      providerLabel: 'Brightline Depot',
      statementDate: recent(1),
      figures: {
        currentValue: '3200.00',
        expectedMonthly: '120.00',
        contributionMonthly: '100.00',
      },
    },
  ];
}

if (['demo', 'realistic'].includes(args.profile))
  records.splice(0, records.length, ...demoRecords());

const summary = records.reduce(
  (a, r) => ((a[r.contractType] = (a[r.contractType] ?? 0) + 1), a),
  {},
);
console.log(`${records.length} records`, JSON.stringify(summary));
console.log(`imported: ${records.filter((r) => r.origin === 'IMPORTED').length}`);

if (args.out) {
  writeFileSync(args.out, JSON.stringify(records, null, 2));
  console.log(`written to ${args.out}`);
  process.exit(0);
}

const base = args.base ?? 'http://localhost:3000';
if (!args.email || !args.password) throw new Error('--email and --password (or --out) required');

const signIn = await fetch(`${base}/auth/sign-in`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ email: args.email, password: args.password }),
});
if (!signIn.ok) throw new Error(`sign-in failed: ${signIn.status}`);
const cookie = signIn.headers
  .getSetCookie()
  .map((c) => c.split(';')[0])
  .join('; ');
const headers = { 'content-type': 'application/json', cookie };

const existing = await (await fetch(`${base}/retirement/records`, { headers })).json();
if (existing.length > 0) {
  if (!args.replace)
    throw new Error(`account already has ${existing.length} records; pass --replace`);
  const del = await fetch(`${base}/retirement`, { method: 'DELETE', headers });
  if (del.status !== 204) throw new Error(`DELETE /retirement failed: ${del.status}`);
}

let done = 0;
for (const record of records) {
  const res = await fetch(`${base}/retirement/records`, {
    method: 'POST',
    headers,
    body: JSON.stringify(record),
  });
  if (res.status !== 201)
    throw new Error(
      `#${done} ${record.contractType}/${record.origin}: ${res.status} ${await res.text()}`,
    );
  done++;
}
console.log(`uploaded ${done} records`);
