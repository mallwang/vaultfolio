#!/usr/bin/env node
/**
 * Loads a synthetic account overview (banks, brokers, cards) through the REST API.
 * Comprehensive: 58 entries over every category, a 100-char name, long free text, entries without
 * a category/provider, duplicate names and a website without scheme. Realistic: 8 plausible entries.
 * All names are INVENTED; the set is deterministic.
 *
 *   node tools/account-overview/seed-account-overview-testset.mjs --email <e> --password <p>
 *        [--base http://localhost:3000] [--profile realistic] [--replace] [--out accounts.json]
 */
import { writeFileSync } from 'node:fs';
import { parseArgs, signIn } from '../seed-lib.mjs';

const args = parseArgs();
const REALISTIC = ['demo', 'realistic'].includes(args.profile);

const entry = (name, category, provider, extra = {}) => ({ name, category, provider, ...extra });

function realistic() {
  return [
    entry('Girokonto', 'GENERAL', 'Musterbank', {
      website: 'https://www.musterbank.example',
      purpose: 'Gehalt, Miete und laufende Kosten',
    }),
    entry('Freizeitkonto', 'LEISURE', 'Musterbank', {
      purpose: 'Hobbys, Restaurants, Urlaub',
      notes: 'Dauerauftrag 250 € am Monatsersten',
    }),
    entry('Tagesgeld', 'SAVINGS', 'Nordlicht Direktbank', {
      website: 'https://www.nordlicht-direkt.example',
      purpose: 'Notgroschen',
      requiredMinimum: '1.000 €',
    }),
    entry('Kreditkarte', 'CREDIT_CARD', 'Musterbank', {
      purpose: 'Reisen und Online-Käufe',
      cardUsage: 'Kontaktlos und online, Abrechnung monatlich',
    }),
    entry('Depot', 'OTHER', 'Brightline Broker', {
      website: 'https://www.brightline-broker.example',
      purpose: 'ETF-Sparplan',
    }),
    entry('Gemeinschaftskonto', 'GENERAL', 'Stadtsparkasse Musterstadt', {
      purpose: 'Haushaltskonto mit Partner',
    }),
    entry('Urlaubssparen', 'SAVINGS', 'Nordlicht Direktbank', { purpose: 'Reise 2027' }),
    entry('Prepaid-Karte', 'CREDIT_CARD', 'Alpenland Pay', {
      cardUsage: 'Nur für Reisen im Ausland',
    }),
  ];
}

const CATEGORIES = ['GENERAL', 'LEISURE', 'SAVINGS', 'CREDIT_CARD', 'OTHER'];
const PROVIDERS = [
  'Musterbank',
  'Nordlicht Direktbank',
  'Brightline Broker',
  'Stadtsparkasse Musterstadt',
  'Alpenland Pay',
  'Hanseatische Handelsbank',
];

function comprehensive() {
  const out = [];
  for (let i = 0; i < 50; i++) {
    const category = CATEGORIES[i % CATEGORIES.length];
    out.push(
      entry(`Konto ${String(i + 1).padStart(2, '0')}`, category, PROVIDERS[i % PROVIDERS.length], {
        ...(i % 2 === 0 ? { website: `https://bank${i}.example` } : {}),
        ...(i % 3 === 0 ? { purpose: `Zweck des Kontos ${i + 1}` } : {}),
        ...(category === 'CREDIT_CARD' ? { cardUsage: 'Kontaktlos, kein Bargeld' } : {}),
        ...(category === 'SAVINGS' ? { requiredMinimum: `${(i + 1) * 100} €` } : {}),
      }),
    );
  }
  out.push(
    entry('N'.repeat(100), 'GENERAL', 'P'.repeat(100), {
      website: 'www.ohne-schema.example/pfad?x=1&y=2',
      purpose: 'Zweck '.repeat(80).trim(),
      cardUsage: 'Karte '.repeat(80).trim(),
      requiredMinimum: 'Mindestsaldo '.repeat(20).trim(),
      notes: 'Notiz '.repeat(300).trim(),
    }),
    entry('Sparkonto', 'SAVINGS', 'Musterbank'),
    entry('Sparkonto', 'SAVINGS', 'Musterbank'), // duplicate names are allowed
    entry('Nur ein Name', undefined, undefined), // category defaults to OTHER
    entry('Umlaute äöüß – 日本語 – 🙂', 'LEISURE', 'Größenwahn & Söhne <Bank>'),
    entry('Ohne Kategorie, mit Anbieter', undefined, 'Brightline Broker'),
    entry('Karte mit Details', 'CREDIT_CARD', 'Alpenland Pay', {
      cardUsage: 'Nur online, 3D-Secure, Limit 2.000 €',
      requiredMinimum: '0 €',
      notes: 'Läuft im Juni 2028 ab',
    }),
    entry('Konto mit Zeilenumbruch', 'OTHER', 'Musterbank', { notes: 'Zeile 1\nZeile 2\nZeile 3' }),
  );
  return out;
}

const accounts = REALISTIC ? realistic() : comprehensive();
console.log(`${accounts.length} account-overview entries`);

if (args.out) {
  writeFileSync(args.out, JSON.stringify(accounts, null, 2));
  console.log(`written to ${args.out}`);
  process.exit(0);
}

const base = args.base ?? 'http://localhost:3000';
const headers = await signIn(base, args.email, args.password);
const url = `${base}/account-overview/accounts`;

const existingRes = await fetch(url, { headers });
if (!existingRes.ok) throw new Error(`GET account-overview failed: ${existingRes.status}`);
const existing = await existingRes.json();
if (existing.length > 0) {
  if (!args.replace)
    throw new Error(`account already has ${existing.length} entries; pass --replace`);
  for (const { id } of existing) {
    const del = await fetch(`${url}/${id}`, { method: 'DELETE', headers });
    if (del.status !== 204) throw new Error(`DELETE ${id} failed: ${del.status}`);
  }
}

let done = 0;
for (const account of accounts) {
  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(account) });
  if (res.status !== 201)
    throw new Error(`${account.name.slice(0, 30)}: ${res.status} ${await res.text()}`);
  done++;
}
console.log(`uploaded ${done} entries`);
