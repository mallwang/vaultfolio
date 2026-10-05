#!/usr/bin/env node
/**
 * Generates a synthetic insurance portfolio for limit testing and loads it through the REST API:
 * one contract for every catalog type (several for some), all four payment intervals, every
 * cancellation variant (period in weeks/months, fixed date, minimum term, no auto-renew), combo
 * products (`alsoCovers`), cancelled/ended/future contracts, deadlines inside the warning window,
 * 100-char names, maximum amounts and a full profile. All names and figures are INVENTED; dates are
 * relative to today so the deadline warnings always show.
 *
 *   node tools/insurances/seed-insurances-testset.mjs --email <e> --password <p> [--base http://localhost:3000]
 *        [--profile realistic]  # 7 plausible contracts instead (Member account; default: comprehensive)
 *        [--replace]            # DELETE /insurances first (otherwise refuses on a non-empty account)
 *        [--with-statutory]     # also add manual statutory contracts (hides the Earnings-linked lines)
 *        [--bulk 200]           # pad with generated contracts up to this total (MAX_CONTRACTS is 200)
 *        [--out contracts.json] # write the JSON only, no upload
 */
import { writeFileSync } from 'node:fs';

const args = Object.fromEntries(
  process.argv.slice(2).flatMap((a, i, all) => {
    if (!a.startsWith('--')) return [];
    const next = all[i + 1];
    return [[a.slice(2), next && !next.startsWith('--') ? next : true]];
  }),
);

const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const now = new Date();
const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
/** Date `days` from today (negative = past). */
const offset = (days) => iso(new Date(today.getTime() + days * 86_400_000));
/** Date `months` from today, same day of month clamped to 28. */
const months = (n) =>
  iso(
    new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + n, Math.min(today.getUTCDate(), 28)),
    ),
  );

const LONG_NAME =
  'Rundum-sorglos-Komplettschutz für Haus, Hof, Garten, Werkstatt, Fuhrpark und alle Familienmitglieder'.slice(
    0,
    100,
  );
const LONG_INSURER =
  'Süddeutsche Versicherungs- und Rückversicherungs-Gesellschaft auf Gegenseitigkeit im Verbund'.slice(
    0,
    100,
  );
const LONG_NOTE = 'Notiz '.repeat(83).trim().slice(0, 500);

const yearlyAuto = { autoRenew: true, period: { value: 3, unit: 'MONTHS' }, renewalMonths: 12 };
const base = (type, name, premium, interval, over = {}) => ({
  type,
  name,
  status: 'ACTIVE',
  startDate: months(-30),
  premium,
  interval,
  cancellation: yearlyAuto,
  reminderEnabled: true,
  ...over,
});

const contracts = [
  // Persons
  base('PRIVATE_HEALTH', 'Private Krankenvollversicherung', '612.40', 'MONTHLY', {
    insurer: 'Nordlicht Krankenversicherung AG',
    contractNumber: 'PKV-2014-0081516',
    details: { deductible: '600.00' },
    cancellation: { autoRenew: true, period: { value: 3, unit: 'MONTHS' }, minimumTermMonths: 24 },
  }),
  base('SUPPLEMENTARY_HEALTH', 'Krankenhauszusatz Einbettzimmer', '38.90', 'MONTHLY', {
    insurer: 'Hanse Merkur Muster',
    details: { deductible: '0.00' },
  }),
  base('DENTAL_SUPPLEMENT', 'Zahnzusatz 90 %', '27.50', 'QUARTERLY', {
    cancellation: { autoRenew: true, period: { value: 6, unit: 'WEEKS' }, renewalMonths: 12 },
  }),
  base('TRAVEL_HEALTH', 'Auslandsreisekranken Familie', '14.80', 'YEARLY', {
    paymentMonth: 3,
    cancellation: { autoRenew: true, period: { value: 1, unit: 'MONTHS' }, renewalMonths: 12 },
  }),
  base('LONG_TERM_CARE', 'Pflegetagegeld Plus', '56.00', 'MONTHLY', {
    details: { insuredMonthlyBenefit: '2400.00' },
    cancellation: { autoRenew: false },
  }),
  base('DISABILITY', 'Berufsunfähigkeit 2.500 € Rente', '142.35', 'MONTHLY', {
    insurer: 'Alpenland Leben',
    details: { insuredMonthlyBenefit: '2500.00' },
    cancellation: { autoRenew: false },
    note: 'Dynamik 3 % jährlich',
  }),
  base('TERM_LIFE', 'Risikoleben 400.000 € bis 2045', '31.20', 'MONTHLY', {
    details: { coverageSum: '400000.00' },
    cancellation: { autoRenew: false, minimumTermMonths: 240 },
  }),
  base('ACCIDENT', 'Unfallversicherung Familie', '184.00', 'HALF_YEARLY', {
    paymentMonth: 6,
    details: { coverageSum: '250000.00' },
  }),
  // Liability
  base('PRIVATE_LIABILITY', 'Privathaftpflicht Familie', '96.00', 'YEARLY', {
    paymentMonth: 1,
    startDate: months(-60),
    details: { coverageSum: '50000000.00', deductible: '0.00' },
    // deadline falls inside the warning window
    endDate: offset(60),
    cancellation: { autoRenew: true, period: { value: 1, unit: 'MONTHS' }, renewalMonths: 12 },
  }),
  base('PET_LIABILITY', 'Hundehaftpflicht Rufus', '71.40', 'YEARLY', {
    paymentMonth: 4,
    details: { coverageSum: '10000000.00', deductible: '150.00' },
  }),
  base('PROPERTY_OWNER_LIABILITY', 'Haus- und Grundbesitzerhaftpflicht', '48.00', 'YEARLY', {
    paymentMonth: 11,
    details: { coverageSum: '10000000.00' },
  }),
  // Property
  base('HOUSEHOLD', 'Hausrat 120 m²', '189.00', 'YEARLY', {
    paymentMonth: 2,
    details: { insuredSum: '84000.00', deductible: '150.00' },
    alsoCovers: ['GLASS', 'BICYCLE'],
  }),
  base('BUILDING', 'Wohngebäude gleitender Neuwert', '864.50', 'YEARLY', {
    paymentMonth: 12,
    details: { insuredSum: '620000.00', deductible: '500.00' },
    alsoCovers: ['NATURAL_HAZARD'],
    cancellation: {
      autoRenew: true,
      period: { value: 3, unit: 'MONTHS' },
      fixedDate: { day: 30, month: 11 },
    },
  }),
  base('NATURAL_HAZARD', 'Elementar Zusatz Gebäude', '210.00', 'YEARLY', {
    paymentMonth: 12,
    details: { coverageSum: '620000.00', deductible: '1500.00' },
  }),
  base('GLASS', 'Glasbruch Wintergarten', '36.00', 'YEARLY', { details: { deductible: '50.00' } }),
  // Mobility
  base('CAR', 'Kfz VW Golf Vollkasko', '412.80', 'YEARLY', {
    paymentMonth: 1,
    insurer: 'Verkehrs-Union Muster',
    details: {
      licensePlate: 'MS-AB 1234',
      noClaimsClass: 'SF 12',
      deductible: '300.00',
      coverageSum: '100000000.00',
    },
    cancellation: {
      autoRenew: true,
      period: { value: 1, unit: 'MONTHS' },
      fixedDate: { day: 30, month: 11 },
    },
  }),
  base('CAR', 'Kfz Zweitwagen Fiat 500 Teilkasko', '188.00', 'HALF_YEARLY', {
    details: { licensePlate: 'MS-CD 987E', noClaimsClass: 'SF 3', deductible: '150.00' },
    cancellation: {
      autoRenew: true,
      period: { value: 1, unit: 'MONTHS' },
      fixedDate: { day: 30, month: 11 },
    },
  }),
  base('CAR', 'Kfz Oldtimer Saisonkennzeichen', '96.00', 'YEARLY', {
    paymentMonth: 4,
    details: { licensePlate: 'MS-H 55', noClaimsClass: 'SF 20' },
  }),
  base('BICYCLE', 'E-Bike Vollkasko', '119.00', 'YEARLY', {
    paymentMonth: 5,
    details: { insuredSum: '4200.00', deductible: '50.00' },
  }),
  // Legal / other
  base('LEGAL_PROTECTION', 'Rechtsschutz Privat, Beruf, Verkehr', '29.90', 'MONTHLY', {
    details: { deductible: '150.00' },
    insurer: 'Rechtsschutz Roland-Muster',
  }),
  base('OTHER', 'Handyversicherung', '6.99', 'MONTHLY', {
    details: { coverageSum: '1200.00', deductible: '25.00' },
  }),
  base('OTHER', 'Reiserücktritt Jahrespolice', '89.00', 'YEARLY', { paymentMonth: 9 }),

  // Limits and edge cases
  base('OTHER', LONG_NAME, '99999.99', 'YEARLY', {
    insurer: LONG_INSURER,
    contractNumber: 'X'.repeat(50),
    note: LONG_NOTE,
    details: { coverageSum: '999999999.99', deductible: '999999999.99' },
  }),
  base('OTHER', 'Kleinstbeitrag', '0.01', 'MONTHLY'),
  base('PRIVATE_LIABILITY', 'Alte Haftpflicht (gekündigt)', '84.00', 'YEARLY', {
    status: 'CANCELLED',
    startDate: months(-100),
    endDate: months(-14),
    reminderEnabled: false,
  }),
  base('HOUSEHOLD', 'Hausrat Vorwohnung (beendet)', '120.00', 'YEARLY', {
    status: 'ENDED',
    startDate: months(-120),
    endDate: months(-40),
    reminderEnabled: false,
  }),
  base('LEGAL_PROTECTION', 'Rechtsschutz (beginnt in der Zukunft)', '24.00', 'MONTHLY', {
    startDate: months(2),
  }),
  base('ACCIDENT', 'Unfall mit Frist morgen', '60.00', 'YEARLY', {
    endDate: offset(1),
    cancellation: { autoRenew: true, period: { value: 0, unit: 'WEEKS' }, renewalMonths: 12 },
  }),
  base('OTHER', 'Jederzeit kündbar ohne Frist', '12.00', 'MONTHLY', {
    cancellation: { autoRenew: false },
  }),
  base('PET_LIABILITY', 'Pferdehaftpflicht ohne Erinnerung', '110.00', 'YEARLY', {
    reminderEnabled: false,
    endDate: offset(20),
  }),
];

if (args['with-statutory']) {
  contracts.push(
    base('STATUTORY_HEALTH', 'Gesetzliche Krankenkasse', '412.00', 'MONTHLY', {
      cancellation: { autoRenew: false },
    }),
    base('STATUTORY_CARE', 'Soziale Pflegeversicherung', '98.00', 'MONTHLY', {
      cancellation: { autoRenew: false },
    }),
    base('STATUTORY_PENSION', 'Gesetzliche Rentenversicherung', '540.00', 'MONTHLY', {
      cancellation: { autoRenew: false },
    }),
    base('STATUTORY_UNEMPLOYMENT', 'Arbeitslosenversicherung', '62.00', 'MONTHLY', {
      cancellation: { autoRenew: false },
    }),
  );
}

const TYPES = [
  'PRIVATE_LIABILITY',
  'HOUSEHOLD',
  'CAR',
  'BICYCLE',
  'LEGAL_PROTECTION',
  'OTHER',
  'ACCIDENT',
];
const INTERVALS = ['MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'YEARLY'];
for (let i = 0; contracts.length < Number(args.bulk ?? 0) && contracts.length < 200; i++) {
  contracts.push(
    base(
      TYPES[i % TYPES.length],
      `Bulk-Vertrag ${pad(i + 1)}`,
      (5 + ((i * 37) % 400)).toFixed(2),
      INTERVALS[i % 4],
      {
        startDate: months(-(i % 48)),
        ...(i % 5 === 0 ? { endDate: offset(30 + i * 3) } : {}),
        reminderEnabled: i % 3 !== 0,
      },
    ),
  );
}

const REALISTIC = ['demo', 'realistic'].includes(args.profile);
if (REALISTIC) {
  contracts.splice(
    0,
    contracts.length,
    base('PRIVATE_LIABILITY', 'Privathaftpflicht', '78.00', 'YEARLY', {
      insurer: 'Nordlicht Versicherung',
      paymentMonth: 1,
      startDate: months(-48),
      details: { coverageSum: '50000000.00', deductible: '0.00' },
    }),
    base('HOUSEHOLD', 'Hausrat 85 m²', '96.00', 'YEARLY', {
      insurer: 'Nordlicht Versicherung',
      paymentMonth: 2,
      details: { insuredSum: '60000.00', deductible: '150.00' },
    }),
    base('LEGAL_PROTECTION', 'Rechtsschutz Privat und Verkehr', '24.90', 'MONTHLY', {
      details: { deductible: '150.00' },
    }),
    base('CAR', 'Kfz Teilkasko', '312.00', 'YEARLY', {
      paymentMonth: 1,
      details: { licensePlate: 'MS-XY 123', noClaimsClass: 'SF 8', deductible: '150.00' },
      cancellation: {
        autoRenew: true,
        period: { value: 1, unit: 'MONTHS' },
        fixedDate: { day: 30, month: 11 },
      },
    }),
    base('DISABILITY', 'Berufsunfähigkeit', '89.00', 'MONTHLY', {
      insurer: 'Alpenland Leben',
      details: { insuredMonthlyBenefit: '1800.00' },
      cancellation: { autoRenew: false },
    }),
    base('TERM_LIFE', 'Risikoleben', '19.50', 'MONTHLY', {
      details: { coverageSum: '200000.00' },
      cancellation: { autoRenew: false },
    }),
    base('TRAVEL_HEALTH', 'Auslandsreisekranken', '14.80', 'YEARLY', { paymentMonth: 3 }),
  );
}

const settings = REALISTIC
  ? {
      profile: {
        ownsProperty: false,
        ownsCar: true,
        hasChildren: false,
        hasPets: false,
        travelsAbroad: true,
        employment: 'EMPLOYED',
      },
      reminders: { enabled: true, leadDays: 60 },
      dismissedRequirements: [],
      includeSocial: true,
    }
  : {
      profile: {
        ownsProperty: true,
        ownsCar: true,
        hasChildren: true,
        hasPets: true,
        travelsAbroad: true,
        employment: 'EMPLOYED',
      },
      reminders: { enabled: true, leadDays: 90 },
      dismissedRequirements: [],
      includeSocial: true,
    };

console.log(`${contracts.length} contracts (${new Set(contracts.map((c) => c.type)).size} types)`);

if (args.out) {
  writeFileSync(args.out, JSON.stringify({ contracts, settings }, null, 2));
  console.log(`written to ${args.out}`);
  process.exit(0);
}

const api = args.base ?? 'http://localhost:3000';
if (!args.email || !args.password) throw new Error('--email and --password (or --out) required');

const signIn = await fetch(`${api}/auth/sign-in`, {
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

const existing = await fetch(`${api}/insurances`, { headers });
if (!existing.ok)
  throw new Error(`GET /insurances failed: ${existing.status} ${await existing.text()}`);
const current = (await existing.json()).contracts;
if (current.length > 0) {
  if (!args.replace)
    throw new Error(`account already has ${current.length} contracts; pass --replace`);
  const del = await fetch(`${api}/insurances`, { method: 'DELETE', headers });
  if (del.status !== 204) throw new Error(`DELETE /insurances failed: ${del.status}`);
}

let done = 0;
for (const contract of contracts) {
  const res = await fetch(`${api}/insurances/contracts`, {
    method: 'POST',
    headers,
    body: JSON.stringify(contract),
  });
  if (res.status !== 201) throw new Error(`${contract.name}: ${res.status} ${await res.text()}`);
  done++;
}
const saved = await fetch(`${api}/insurances/settings`, {
  method: 'PUT',
  headers,
  body: JSON.stringify(settings),
});
if (!saved.ok) throw new Error(`PUT settings failed: ${saved.status} ${await saved.text()}`);
console.log(`uploaded ${done} contracts and the profile`);
