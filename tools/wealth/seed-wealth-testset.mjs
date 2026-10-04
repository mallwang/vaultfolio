#!/usr/bin/env node
/**
 * Generates a synthetic wealth history for limit testing and loads it through the REST API
 * (there is no wealth import): 597 monthly snapshots (1977-01-31 … 2026-09-30, MAX_SNAPSHOTS is
 * 600) with 5–27 entries each — standard and custom classes, both sides, a 100-char entry name,
 * a 50-char custom class, notes, a few zero amounts and a stretch of negative net worth.
 * All names and figures are INVENTED; the series is deterministic.
 *
 *   node tools/wealth/seed-wealth-testset.mjs --email <e> --password <p> [--base http://localhost:3000]
 *        [--profile demo]       # realistic 2016-01 … 2026-09 set instead (Member demo account)
 *        [--out snapshots.json]   # write the JSON only, no upload
 *        [--replace]              # DELETE /wealth first (otherwise refuses on a non-empty account)
 */
import { writeFileSync } from 'node:fs';

const args = Object.fromEntries(
  process.argv.slice(2).flatMap((a, i, all) => {
    if (!a.startsWith('--')) return [];
    const next = all[i + 1];
    return [[a.slice(2), next && !next.startsWith('--') ? next : true]];
  }),
);

// mulberry32 — deterministic
let seed = 20261004;
function rnd() {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const gauss = () => Math.sqrt(-2 * Math.log(1 - rnd())) * Math.cos(2 * Math.PI * rnd());

const LONG_NAME =
  'Gemeinschaftliches Anlagedepot bei der Süddeutschen Genossenschaftlichen Zentralbank für langfristige Vorsorge'.slice(
    0,
    100,
  );
const LONG_CLASS = 'Sammlung historischer Landkarten und Atlanten (Erstausgaben)'.slice(0, 50);

const fmt = (n) => Math.max(0, n).toFixed(2);
const monthEnd = (y, m) => new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);

// Monthly market returns (log) with crash years; securities / crypto / metals each get their own.
const CRASH = {
  1987: [9, -0.2],
  2001: [4, -0.12],
  2002: [6, -0.12],
  2008: [9, -0.2],
  2020: [2, -0.25],
  2022: [5, -0.1],
};
function marketReturn(year, month, drift, vol) {
  const c = CRASH[year];
  const shock = c && month >= c[0] && month < c[0] + 3 ? c[1] / 3 : 0;
  return drift + vol * gauss() + shock;
}

/** Realistic demo set: 129 monthly snapshots 2016-01 … 2026-09, 6–11 entries, never negative. */
function demoSnapshots() {
  const out = [];
  let tagesgeld = 8000;
  let etf = 0;
  let aktien = 0;
  let gold = 0;
  let btc = 0;
  let wohnung = 0;
  let darlehen = 0;
  let auto = 14000;
  let autoKredit = 0;
  for (let y = 2016; y <= 2026; y++) {
    for (let m = 1; m <= 12; m++) {
      if (y === 2026 && m > 9) break;
      const notes = [];
      tagesgeld += 380 + (m === 12 ? 600 : 0);
      etf = etf * Math.exp(marketReturn(y, m, 0.006, 0.035)) + (y >= 2016 ? 450 : 0);
      if (y >= 2018)
        aktien =
          aktien * Math.exp(marketReturn(y, m, 0.005, 0.045)) +
          (y === 2018 && m === 1 ? 4000 : 120);
      if (y >= 2019)
        gold =
          gold * Math.exp(marketReturn(y, m, 0.003, 0.025)) +
          (m % 3 === 0 ? 100 : 0) +
          (y === 2019 && m === 1 ? 1500 : 0);
      if (y >= 2020)
        btc = btc * Math.exp(marketReturn(y, m, 0.015, 0.14)) + (y === 2020 && m === 6 ? 1000 : 0);
      if (y === 2019 && m === 4) {
        wohnung = 285000;
        darlehen = 225000;
        tagesgeld -= 30000;
        notes.push('Eigentumswohnung gekauft');
      } else if (wohnung > 0) {
        wohnung *= 1 + (y < 2023 ? 0.005 : y === 2023 ? -0.002 : 0.003);
        darlehen = Math.max(0, darlehen - 700);
      }
      auto = auto * 0.992;
      if (y === 2022 && m === 5) {
        auto = 31000;
        autoKredit = 18000;
        notes.push('Neues Auto, teilfinanziert');
      } else if (autoKredit > 0) autoKredit = Math.max(0, autoKredit - 320);
      if (m === 12) notes.push(`Jahresabschluss ${y}`);

      const entries = [];
      const add = (side, cls, name, amount) =>
        entries.push({ side, class: cls, name, amount: fmt(amount) });
      add('ASSET', { standard: 'bankBalances' }, 'Girokonto', 2500 + 400 * Math.sin(y * 12 + m));
      add('ASSET', { standard: 'bankBalances' }, 'Tagesgeld', tagesgeld);
      add('ASSET', { standard: 'securities' }, 'Welt-ETF Sparplan', etf);
      if (aktien > 0) add('ASSET', { standard: 'securities' }, 'Einzelaktien', aktien);
      if (gold > 0) add('ASSET', { standard: 'preciousMetals' }, 'Gold', gold);
      if (btc > 0) add('ASSET', { standard: 'crypto' }, 'Bitcoin', btc);
      if (wohnung > 0) add('ASSET', { standard: 'realEstate' }, 'Eigentumswohnung', wohnung);
      add('ASSET', { standard: 'vehicles' }, 'Auto', auto);
      if (darlehen > 0) add('LIABILITY', { standard: 'mortgage' }, 'Baudarlehen Wohnung', darlehen);
      if (autoKredit > 0) add('LIABILITY', { standard: 'loan' }, 'Autokredit', autoKredit);
      out.push({
        snapshotDate: monthEnd(y, m),
        ...(notes.length ? { note: notes.join(' · ') } : {}),
        entries,
      });
    }
  }
  return out;
}

const START = 1977;
const END_YEAR = 2026;
const END_MONTH = 9;
let inflation = 1; // price level, 1977 = 1
let cash = 600;
let bank = 1800;
let securities = 0;
let metals = 0;
let crypto = 0;
let car = { value: 0, name: '' };
let house1 = 0; // purchased 1990-05
let mortgage1 = 0;
let house2 = 0; // purchased 2009-03
let mortgage2 = 0;
let consumerLoan = 0;
let studyLoan = 0; // negative-net-worth start
let creditCard = 0;
let whisky = 0;
let maps = 0;
let stamps = 0;
let vintageCar = 0;
let bonds = 0; // custom "Anleihen-Treppe"
let p2p = 0;
let crowdInvest = 0;
const snapshots = [];

for (let y = START; y <= END_YEAR; y++) {
  for (let m = 1; m <= 12; m++) {
    if (y === END_YEAR && m > END_MONTH) break;
    const idx = (y - START) * 12 + (m - 1);
    inflation *= 1 + (y < 1990 ? 0.0022 : y < 2020 ? 0.0015 : y < 2023 ? 0.0035 : 0.002);
    const income = 1100 * inflation; // net monthly income
    const saving = income * (y < 1983 ? 0.02 : 0.12 + 0.05 * Math.sin(idx / 40));
    const notes = [];

    // cash & bank
    cash = Math.max(50, cash * (1 + 0.003 * gauss()) + (rnd() - 0.5) * 80 * inflation);
    bank = bank * (1 + (y < 2010 ? 0.0025 : y < 2022 ? 0.0003 : 0.002)) + saving * 0.5;
    // securities from 1984
    if (y >= 1984) {
      securities =
        securities * Math.exp(marketReturn(y, m, 0.0055, 0.04)) +
        saving * 0.35 +
        (y === 1984 && m === 1 ? 3000 : 0);
    }
    if (y >= 1996)
      metals =
        metals * Math.exp(marketReturn(y, m, 0.004, 0.035)) +
        (m % 3 === 0 ? 150 * inflation : 0) +
        (y === 1996 && m === 1 ? 2000 : 0);
    if (y > 2013 || (y === 2013 && m >= 6)) {
      crypto =
        crypto === 0
          ? 800
          : crypto * Math.exp(marketReturn(y, m, 0.02, 0.18)) + (m % 4 === 0 ? 100 : 0);
      if (y === 2022 && m >= 5 && m <= 12) crypto *= 0.95;
    }
    // vehicles: replaced every 7 years, depreciating
    if (idx % 84 === 0) {
      const price = 6000 * inflation * (1 + (idx / 84) * 0.15);
      car = {
        value: price,
        name:
          [
            'Opel Kadett',
            'VW Golf',
            'Ford Mondeo',
            'Audi A4',
            'Skoda Octavia',
            'VW Passat',
            'Tesla Model 3',
          ][Math.floor(idx / 84)] ?? 'Familienauto',
      };
      if (idx > 0) notes.push(`Neues Auto: ${car.name}`);
    } else car.value *= 0.9925;
    // consumer loans around car purchases
    if (idx % 84 === 2) consumerLoan = car.value * 0.6;
    else if (consumerLoan > 0) consumerLoan = Math.max(0, consumerLoan - (car.value * 0.6) / 48);
    // study loan 1977-1984 (liabilities > assets => negative net worth)
    studyLoan = y >= 1977 && y < 1990 ? Math.max(0, 9000 - idx * 70) : 0;
    // house 1: buy 1990-05
    if (y === 1990 && m === 5) {
      house1 = 240000 * 0.55;
      mortgage1 = 150000 * 0.55;
      bank *= 0.5;
      notes.push('Hauskauf (Eigenheim)');
    } else if (house1 > 0) {
      house1 *= 1 + (y < 2005 ? 0.002 : y < 2022 ? 0.0045 : y < 2024 ? -0.0015 : 0.003);
      if (mortgage1 > 0) mortgage1 = Math.max(0, mortgage1 - (y < 2010 ? 480 : 600));
      if (mortgage1 === 0 && !snapshots.some((s) => s.note?.includes('Hypothek 1')))
        notes.push('Hypothek 1 abgezahlt');
    }
    // house 2: buy 2009-03 as investment
    if (y === 2009 && m === 3) {
      house2 = 210000;
      mortgage2 = 180000;
      notes.push('Mietobjekt erworben');
    } else if (house2 > 0) {
      house2 *= 1 + (y < 2022 ? 0.0055 : y < 2024 ? -0.002 : 0.0035);
      mortgage2 = Math.max(0, mortgage2 - 520 - (y > 2018 ? 200 : 0));
    }
    // credit card: revolves
    creditCard = rnd() < 0.7 ? 150 + 900 * rnd() * (inflation / 2) : 0;
    // collectibles
    if (y >= 1992) whisky = whisky * (1 + 0.004 + 0.01 * gauss()) + (m === 12 ? 300 : 0);
    if (y >= 2003) maps = maps * (1 + 0.003 + 0.006 * gauss()) + (m === 6 ? 500 : 0);
    if (y >= 1979) stamps = stamps * 1.001 + (m === 1 ? 40 : 0);
    if (y >= 2012)
      vintageCar = vintageCar === 0 ? 38000 : vintageCar * (1 + 0.004 + 0.004 * gauss());
    if (y >= 1998) bonds = bonds * 1.003 + (m === 3 ? 600 : 0);
    if (y >= 2016 && y <= 2024)
      p2p = p2p === 0 ? 5000 : p2p * (1 + 0.005 - (y === 2022 ? 0.004 : 0));
    if (y >= 2019)
      crowdInvest =
        crowdInvest === 0 ? 10000 : crowdInvest * (1 + 0.003 + (rnd() < 0.02 ? -0.15 : 0));
    if (y === 2024 && m === 1) p2p = 0;
    if (m === 12) notes.push(`Jahresabschluss ${y}`);
    if (idx === 0) notes.push('Startwert');

    const entries = [];
    const asset = (cls, name, amount) => {
      if (amount === null) return;
      entries.push({ side: 'ASSET', class: cls, name, amount: fmt(amount) });
    };
    const debt = (cls, name, amount) => {
      if (amount > 0 || cls.standard === 'otherDebt')
        entries.push({ side: 'LIABILITY', class: cls, name, amount: fmt(amount) });
    };
    asset({ standard: 'cash' }, 'Bargeld Haushaltskasse', cash);
    asset({ standard: 'bankBalances' }, 'Girokonto Sparkasse', bank * 0.15 + 300);
    asset({ standard: 'bankBalances' }, 'Tagesgeld', bank * 0.55);
    if (y >= 1986) asset({ standard: 'bankBalances' }, 'Festgeld', bank * 0.3);
    if (y >= 1984) {
      asset({ standard: 'securities' }, 'Welt-ETF Sparplan', securities * 0.55);
      asset({ standard: 'securities' }, 'Einzelaktien (Dividendenwerte)', securities * 0.3);
      if (y >= 2008) asset({ standard: 'securities' }, LONG_NAME, securities * 0.15);
    }
    if (y >= 1996) {
      asset({ standard: 'preciousMetals' }, 'Gold Barren & Münzen', metals * 0.8);
      asset({ standard: 'preciousMetals' }, 'Silber Anlagemünzen', metals * 0.2);
    }
    if (crypto > 0) {
      asset({ standard: 'crypto' }, 'Bitcoin', crypto * 0.65);
      asset({ standard: 'crypto' }, 'Ethereum', y >= 2016 ? crypto * 0.3 : null);
      if (y >= 2021) asset({ standard: 'crypto' }, 'Sonstige Altcoins', crypto * 0.05);
    }
    if (house1 > 0) asset({ standard: 'realEstate' }, 'Eigenheim Musterstadt', house1);
    if (house2 > 0) asset({ standard: 'realEstate' }, 'Mietwohnung Beispielhausen', house2);
    asset({ standard: 'vehicles' }, car.name, car.value);
    if (vintageCar > 0) asset({ custom: 'Oldtimer' }, 'Mercedes 280 SL (Pagode)', vintageCar);
    if (stamps > 0) asset({ standard: 'collectibles' }, 'Briefmarkensammlung', stamps);
    if (whisky > 0) asset({ custom: 'Whisky' }, 'Single Malts (Fassabfüllungen)', whisky);
    if (maps > 0) asset({ custom: LONG_CLASS }, 'Atlas-Konvolut', maps);
    if (bonds > 0) asset({ custom: 'Anleihen-Treppe' }, 'Bundesanleihen gestaffelt', bonds);
    if (p2p > 0) asset({ custom: 'P2P-Kredite' }, 'Kreditplattform', p2p);
    if (crowdInvest > 0) asset({ custom: 'Crowdinvesting' }, 'Startup-Beteiligungen', crowdInvest);
    if (y >= 2005 && m % 6 === 0)
      asset({ standard: 'otherAsset' }, 'Steuererstattung ausstehend', 1200 * rnd());
    if (y >= 2020 && (m === 3 || m === 4))
      asset({ standard: 'otherAsset' }, 'Genossenschaftsanteil', 0); // zero amount

    debt({ standard: 'mortgage' }, 'Baudarlehen Eigenheim', mortgage1);
    debt({ standard: 'mortgage' }, 'Annuitätendarlehen Mietobjekt', mortgage2);
    debt({ standard: 'loan' }, 'Autokredit', consumerLoan);
    debt({ standard: 'loan' }, 'Studienkredit', studyLoan);
    if (y >= 1990) debt({ standard: 'otherDebt' }, 'Kreditkarte', creditCard);
    if (y >= 2021 && y <= 2023)
      debt({ custom: 'Steuernachzahlung' }, 'Nachzahlung Finanzamt', 2500);

    snapshots.push({
      snapshotDate: monthEnd(y, m),
      ...(notes.length ? { note: notes.join(' · ') } : {}),
      entries,
    });
  }
}

if (args.profile === 'demo') snapshots.splice(0, snapshots.length, ...demoSnapshots());

const maxEntries = Math.max(...snapshots.map((s) => s.entries.length));
const minEntries = Math.min(...snapshots.map((s) => s.entries.length));
const net = (s) =>
  s.entries.reduce((a, e) => a + (e.side === 'ASSET' ? 1 : -1) * Number(e.amount), 0);
const negatives = snapshots.filter((s) => net(s) < 0).length;
console.log(
  `${snapshots.length} snapshots, ${minEntries}–${maxEntries} entries each, ${negatives} with negative net worth, ` +
    `latest net worth ${net(snapshots.at(-1)).toFixed(0)}`,
);

if (args.out) {
  writeFileSync(args.out, JSON.stringify(snapshots, null, 2));
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

const existing = await (await fetch(`${base}/wealth/snapshots`, { headers })).json();
if (existing.length > 0) {
  if (!args.replace)
    throw new Error(`account already has ${existing.length} snapshots; pass --replace`);
  const del = await fetch(`${base}/wealth`, { method: 'DELETE', headers });
  if (del.status !== 204) throw new Error(`DELETE /wealth failed: ${del.status}`);
}

let done = 0;
for (const snapshot of snapshots) {
  const res = await fetch(`${base}/wealth/snapshots`, {
    method: 'POST',
    headers,
    body: JSON.stringify(snapshot),
  });
  if (res.status !== 201)
    throw new Error(`${snapshot.snapshotDate}: ${res.status} ${await res.text()}`);
  if (++done % 100 === 0) console.log(`${done}/${snapshots.length}`);
}
console.log(`uploaded ${done} snapshots`);
