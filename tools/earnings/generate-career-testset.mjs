#!/usr/bin/env node
/**
 * Writes a synthetic `earnings-export` v1 JSON (contracts/earnings-export-v1.md) for limit testing:
 * 50 years (1977-01 … 2026-09), 10 employers (one with a very long name), a gap of 8 months, a
 * December bonus in most years and mid-year employer changes. All names and figures are INVENTED.
 *
 *   node tools/earnings/generate-career-testset.mjs --out out.json [--profile realistic]
 *   node tools/earnings/generate-career-testset.mjs --email <e> --password <p> [--base http://localhost:3000]
 *        [--profile realistic] [--replace]     # uploads through POST /earnings/imports
 *
 * `--profile realistic` writes a realistic, edge-case-free career instead: 3 employers, 2014-01 … 2026-09,
 * no gap, plausible salaries (for the Member demo account).
 *
 * Import a written file via Earnings → Import, or upload directly with --email/--password. Every record balances (net = gross − taxes − social).
 */
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { parseArgs, signIn } from '../seed-lib.mjs';

const args = parseArgs();
const DEMO = ['demo', 'realistic'].includes(args.profile);
const LOAD_EMPLOYERS = [
  ['Rheinland Kohle und Stahl AG', 72],
  ['Stadtwerke Musterstadt', 48],
  ['Hanseatische Speditions- und Lagerhaus-Gesellschaft mbH', 96],
  ['Nordlicht Elektronik GmbH', 30, 8],
  ['Süddeutsche Versicherungs-Dienstleistungs-Gesellschaft mbH', 84],
  ['Alpenland Gastronomie Betriebs GmbH', 60],
  ['Kurpfalz Medizintechnik International SE', 36],
  [
    'Mitteldeutsche Bildungs- und Forschungsgesellschaft für angewandte Informationstechnologie und Datenverarbeitung mit beschränkter Haftung',
    66,
  ],
  ['Brightline Software GmbH', 54],
  ['Testfirma', 43],
];
const DEMO_EMPLOYERS = [
  ['Nordlicht Elektronik GmbH', 40],
  ['Brightline Software GmbH', 52],
  ['Musterstadt Informationssysteme AG', 61],
];
const EMPLOYERS = DEMO ? DEMO_EMPLOYERS : LOAD_EMPLOYERS;
const START_YEAR = DEMO ? 2014 : 1977;
const START_SALARY = DEMO ? 3300 : 1500; // monthly gross in the first year
const END_SALARY = DEMO ? 5900 : 7600; // monthly gross in 2026
const SPAN = 2026 - START_YEAR;

const cents = (v) => Math.round(v * 100);
const pad = (n) => String(n).padStart(2, '0');

/** Piecewise-exponential salary growth with a small per-employer step. */
function salary(year, employerIndex) {
  const growth = Math.pow(END_SALARY / START_SALARY, (year - START_YEAR) / SPAN);
  return START_SALARY * growth * (1 + 0.03 * ((employerIndex * 7) % 5));
}

function amountsFor(gross, bonus, year) {
  const total = gross + bonus;
  const rate = Math.min(0.14 + total / 90_000, 0.34);
  const wageTax = cents(gross * rate);
  const bonusTax = cents(bonus * Math.min(rate + 0.06, 0.4));
  const wage = wageTax + bonusTax;
  const soli = year >= 1995 ? Math.round(wage * 0.055) : 0;
  const church = Math.round(wage * 0.08);
  const social = {
    health: cents(total * 0.073),
    care: cents(total * (year >= 1995 ? 0.0085 : 0)),
    pension: cents(total * 0.093),
    unemployment: cents(total * 0.015),
  };
  const sum = Object.values(social).reduce((a, b) => a + b, 0);
  const net = cents(total) - wage - soli - church - sum;
  return {
    amounts: {
      gross: cents(total),
      tax_gross: cents(total),
      sv_gross_kv: cents(total),
      sv_gross_rv: cents(total),
      wage_tax: wage,
      soli,
      church_tax: church,
      ...social,
      net,
      other: 0,
      payout: net,
    },
    ...(bonus > 0 ? { one_off: { gross: cents(bonus), wage_tax: bonusTax } } : {}),
  };
}

const records = [];
let index = 0; // months since 1977-01
EMPLOYERS.forEach(([employer, months, gapAfter], employerIndex) => {
  for (let m = 0; m < months; m++, index++) {
    const year = START_YEAR + Math.floor(index / 12);
    const month = (index % 12) + 1;
    const period = `${year}-${pad(month)}`;
    // Bonus in December, skipped in every 7th year and in the first/last month of a stint.
    const bonus =
      month === 12 && year % 7 !== 0 && m > 0 && m < months - 1
        ? Math.round(salary(year, employerIndex) * (0.6 + ((year * 13) % 10) / 10))
        : 0;
    records.push({
      employer,
      period,
      issued: period,
      kind: 'regular',
      seq: 1,
      ...amountsFor(Math.round(salary(year, employerIndex)), bonus, year),
    });
  }
  index += gapAfter ?? 0;
});

const doc = {
  schema: 'earnings-export',
  version: 1,
  generated: '2026-10-03T12:00:00',
  records,
  certificates: [],
};
const last = records.at(-1).period;
console.log(
  `${records.length} records, ${records[0].period} … ${last}, ${EMPLOYERS.length} employers`,
);

if (args.out) {
  writeFileSync(args.out, JSON.stringify(doc));
  console.log(`written to ${args.out}`);
  process.exit(0);
}

// Export JSON (integer cents) → import API body (money strings), as the Import page does.
const money = (c) => (c / 100).toFixed(2);
const AMOUNT = {
  gross: 'gross',
  tax_gross: 'taxGross',
  sv_gross_kv: 'svGrossKv',
  sv_gross_rv: 'svGrossRv',
  wage_tax: 'wageTax',
  soli: 'soli',
  church_tax: 'churchTax',
  health: 'health',
  care: 'care',
  pension: 'pension',
  unemployment: 'unemployment',
  net: 'net',
  other: 'other',
  payout: 'payout',
};
const ONE_OFF = { gross: 'gross', wage_tax: 'wageTax' };
const body = {
  files: [
    {
      clientFileId: 'file-1',
      fileName: 'career.json',
      sourceType: 'EXPORT_JSON',
      fileSha256: createHash('sha256').update(JSON.stringify(doc)).digest('hex'),
      parserId: 'earnings-export',
      parserVersion: '1',
      certificates: [],
      records: records.map((r) => ({
        employer: r.employer,
        period: r.period,
        issued: r.issued,
        kind: 'REGULAR',
        seq: r.seq,
        amounts: {
          ...Object.fromEntries(Object.values(AMOUNT).map((k) => [k, '0.00'])),
          ...Object.fromEntries(Object.entries(r.amounts).map(([k, v]) => [AMOUNT[k], money(v)])),
          oneOff: Object.fromEntries(
            Object.entries(r.one_off ?? {}).map(([k, v]) => [ONE_OFF[k], money(v)]),
          ),
          employerSubsidy: null,
          ytd: null,
        },
      })),
    },
  ],
};

const base = args.base ?? 'http://localhost:3000';
const headers = await signIn(base, args.email, args.password);
if (args.replace) {
  const del = await fetch(`${base}/earnings`, { method: 'DELETE', headers });
  if (del.status !== 204) throw new Error(`DELETE /earnings failed: ${del.status}`);
}
const res = await fetch(`${base}/earnings/imports`, {
  method: 'POST',
  headers,
  body: JSON.stringify(body),
});
if (res.status !== 201) throw new Error(`import failed: ${res.status} ${await res.text()}`);
const { files } = await res.json();
console.log(`import: ${files.map((f) => f.status).join(', ')}`);
