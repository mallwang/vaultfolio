#!/usr/bin/env node
/**
 * Loads a synthetic holdings portfolio through the REST API (so encryption applies normally) and
 * replaces the account's existing holdings (DELETE /holdings/:id for each, then POST /holdings).
 * All names and figures are INVENTED.
 *
 *   node tools/holdings/seed-holdings-testset.mjs --email <e> --password <p> [--base http://localhost:3000]
 *        [--profile comprehensive|realistic]  # default: comprehensive
 *        [--replace]                           # accepted for seed-all compatibility (always replaces)
 *
 * comprehensive: all five types, merge cases (equal ETF / metal / deposit positions are posted
 * twice and must collapse to one), purchase lots (share, crypto) that must not merge, several
 * brokers/banks, extreme values, 0.00000001 quantities, both metal units, 500-character notes.
 * realistic: a plausible private portfolio with real, checksum-valid ISINs.
 * Exits non-zero on any unexpected status.
 */
import { parseArgs, signIn } from '../seed-lib.mjs';

const args = parseArgs();
const base = args.base ?? 'http://localhost:3000';
const profile = args.profile ?? 'comprehensive';
if (!['comprehensive', 'realistic'].includes(profile))
  throw new Error(`unknown profile ${profile}`);

/** Same checksum as the domain's `isValidIsin`; guards the dataset against typos. */
function isValidIsin(isin) {
  if (!/^[A-Z]{2}[A-Z0-9]{9}\d$/.test(isin)) return false;
  const digits = [...isin].map((c) => (/\d/.test(c) ? c : String(c.charCodeAt(0) - 55))).join('');
  let sum = 0;
  [...digits].reverse().forEach((d, i) => {
    let n = Number(d);
    if (i % 2 === 1) n = n * 2 > 9 ? n * 2 - 9 : n * 2;
    sum += n;
  });
  return sum % 10 === 0;
}

const LONG_NOTE = 'Notiz '.repeat(84).trim().slice(0, 500);
const LONG_TEXT =
  'Gemeinschaftliches Anlagedepot bei der Süddeutschen Genossenschaftlichen Zentralbank'.slice(
    0,
    80,
  );

const etf = (management, isin, name, quantity, purchasePrice, over = {}) => ({
  assetType: 'ETF',
  management,
  isin,
  name,
  quantity,
  purchasePrice,
  ...over,
});
const share = (management, isin, name, quantity, purchasePrice, over = {}) => ({
  assetType: 'SHARE',
  management,
  isin,
  name,
  quantity,
  purchasePrice,
  ...over,
});
const metal = (management, code, quantity, unit, over = {}) => ({
  assetType: 'PRECIOUS_METAL',
  management,
  metal: code,
  quantity,
  unit,
  purchasePrice: '75.00',
  ...over,
});
const crypto = (management, coinId, quantity, purchasePrice, over = {}) => ({
  assetType: 'CRYPTO',
  management,
  coinId,
  quantity,
  purchasePrice,
  ...over,
});
const deposit = (management, name, currentValue, over = {}) => ({
  assetType: 'DEPOSIT_MONEY',
  management,
  name,
  currentValue,
  ...over,
});

const comprehensive = [
  // ETFs (the second post of each pair merges into the first)
  etf('Trade Republic', 'IE00B4L5Y983', 'iShares Core MSCI World', '10', '75.30'),
  etf('Trade Republic', 'IE00B4L5Y983', 'iShares Core MSCI World', '5.5', '81.10'),
  etf('Scalable Capital', 'IE00B4L5Y983', 'iShares Core MSCI World', '20', '70.00', {
    note: 'Sparplan',
  }),
  etf('ING', 'IE00BK5BQT80', 'Vanguard FTSE All-World Acc', '0.00000001', '0.01'),
  etf('Comdirect', 'IE00BKM4GZ66', LONG_TEXT, '999999999.99999999', '999999999.99', {
    note: LONG_NOTE,
  }),
  // Shares (purchase lots, never merged)
  share('Trade Republic', 'DE0007164600', 'SAP SE', '12', '120.50'),
  share('Trade Republic', 'DE0007164600', 'SAP SE', '8', '155.00'),
  share('Scalable Capital', 'US0378331005', 'Apple Inc.', '3.25', '142.37'),
  share('ING', 'DE0007236101', 'Siemens AG', '1', '0.01'),
  // Precious metals (the second post of each pair merges into the first)
  metal('Degussa', 'XAU', '31.1035', 'G', { purchasePrice: '93.24' }),
  metal('Degussa', 'XAU', '2', 'G'),
  metal('Degussa', 'XAG', '10', 'OZT', { purchasePrice: '28.00', note: 'Maple Leaf Münzen' }),
  metal('Tresor zuhause', 'XPT', '0.00000001', 'OZT'),
  metal('Philoro', 'XPD', '999999999.99999999', 'G', {
    purchasePrice: '1.00',
    note: LONG_NOTE,
  }),
  metal('Philoro', 'XAG', '1000', 'G'),
  // Crypto (purchase lots, never merged)
  crypto('Bitvavo', 'bitcoin', '0.00000001', '0.01', { note: 'Ein Satoshi' }),
  crypto('Bitvavo', 'bitcoin', '0.5', '28500.00'),
  crypto('Bitvavo', 'bitcoin', '0.25', '61000.00'),
  crypto('Kraken', 'ethereum', '12.34567891', '1750.00'),
  crypto('Ledger Wallet', 'solana', '999999999.99999999', '999999999.99', { note: LONG_NOTE }),
  crypto('Kraken', 'monero', '3', '150.00'),
  // Deposit money (the second post merges despite different case and spacing)
  deposit('Sparkasse', 'Tagesgeld', '12500.00'),
  deposit('Sparkasse', '  tagesgeld ', '13000.00'),
  deposit('DKB', 'Festgeld 12 Monate', '25000.00', { note: 'Läuft bis Jahresende' }),
  deposit('Raiffeisenbank', LONG_TEXT, '999999999.99', { note: LONG_NOTE }),
  deposit('ING', 'Kinder-Sparbuch', '0.00'),
];

// Purchase values ≈ 100k: ETF 40 %, shares 20 %, metals 20 %, crypto 10 %, deposit money <10 %.
const realistic = [
  etf('Trade Republic', 'IE00B4L5Y983', 'iShares Core MSCI World', '220', '77.40'),
  etf('Trade Republic', 'IE00BKM4GZ66', 'iShares Core MSCI EM IMI', '250', '28.90'),
  etf('Scalable Capital', 'IE00BK5BQT80', 'Vanguard FTSE All-World Acc', '155', '104.20'),
  share('Trade Republic', 'DE0007164600', 'SAP SE', '40', '118.00'),
  share('Trade Republic', 'NL0010273215', 'ASML Holding', '8', '640.00'),
  share('Scalable Capital', 'DE0007236101', 'Siemens AG', '30', '140.00'),
  share('Scalable Capital', 'US0378331005', 'Apple Inc.', '40', '140.00'),
  metal('Degussa', 'XAU', '200', 'G', { purchasePrice: '84.00' }),
  metal('Degussa', 'XAG', '100', 'OZT', { purchasePrice: '28.00' }),
  crypto('Bitvavo', 'bitcoin', '0.2', '31000.00'),
  crypto('Bitvavo', 'ethereum', '2', '1900.00'),
  deposit('Sparkasse', 'Tagesgeld', '4500.00'),
  deposit('DKB', 'Festgeld', '5000.00'),
];

const holdings = profile === 'realistic' ? realistic : comprehensive;
for (const h of holdings)
  if (h.isin && !isValidIsin(h.isin)) throw new Error(`invalid ISIN ${h.isin}`);

const headers = await signIn(base, args.email, args.password);

const list = async () => {
  const res = await fetch(`${base}/holdings`, { headers });
  if (!res.ok) throw new Error(`GET /holdings failed: ${res.status} ${await res.text()}`);
  return res.json();
};

for (const h of await list()) {
  const res = await fetch(`${base}/holdings/${h.id}`, { method: 'DELETE', headers });
  if (res.status !== 204) throw new Error(`DELETE /holdings/${h.id} failed: ${res.status}`);
}

let created = 0;
let merged = 0;
for (const h of holdings) {
  const res = await fetch(`${base}/holdings`, { method: 'POST', headers, body: JSON.stringify(h) });
  if (res.status === 201) created++;
  else if (res.status === 200) merged++;
  else
    throw new Error(
      `${h.assetType} ${h.name ?? h.isin ?? h.metal ?? h.coinId}: ${res.status} ${await res.text()}`,
    );
}

const saved = await list();
if (saved.length !== created)
  throw new Error(`expected ${created} holdings, found ${saved.length}`);
console.log(`holdings (${profile}): ${created} created, ${merged} merged into existing positions`);
