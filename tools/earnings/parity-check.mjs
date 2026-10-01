#!/usr/bin/env node
/**
 * Local-only parity check of the Earnings parsers against earnings-evolution (research R9,
 * quickstart §6). NOT part of CI — it reads the owner's real payslips, which never leave this
 * machine and are never committed.
 *
 *   EARNINGS_PARITY_PDF_DIR=~/projects/earnings-evolution/payslips \
 *   EARNINGS_PARITY_JSON=~/projects/earnings-evolution/data/earnings.json \
 *   node tools/earnings/parity-check.mjs
 *
 * Every PDF goes through the same code path as the browser — the PDF.js text adapter
 * (`libs/frontend/domain/earnings/src/lib/pdf/pdf-text-extractor.ts`) and `parseDocument` from
 * `@vaultfolio/earnings` — and each resulting record/certificate is compared field by field with
 * the one earnings-evolution extracted from the same file.
 *
 * Output is counts and field names only — never an amount (constitution v3.5.0, Sensitive
 * Personal Data). `EARNINGS_PARITY_VERBOSE=1` additionally lists the file names and the names of
 * the differing fields per file, still without amounts.
 */
import { readdirSync, readFileSync, mkdirSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const PDF_DIR = expandHome(process.env.EARNINGS_PARITY_PDF_DIR);
const JSON_PATH = expandHome(process.env.EARNINGS_PARITY_JSON);
const VERBOSE = process.env.EARNINGS_PARITY_VERBOSE === '1';

if (!PDF_DIR || !JSON_PATH) {
  console.error(
    'Set EARNINGS_PARITY_PDF_DIR (payslip PDFs) and EARNINGS_PARITY_JSON (earnings-evolution data/earnings.json).',
  );
  process.exit(2);
}

/** earnings-evolution snake_case amount key → `PayRecordAmounts` key (same mapping as the export v1 reader). */
const AMOUNT_KEYS = {
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
/** Keys of `one_off` and `ytd`. */
const PART_KEYS = {
  gross: 'gross',
  tax_gross: 'taxGross',
  wage_tax: 'wageTax',
  soli: 'soli',
  church_tax: 'churchTax',
  health: 'health',
  care: 'care',
  pension: 'pension',
  unemployment: 'unemployment',
};
const SUBSIDY_KEYS = { health_subsidy: 'health', care_subsidy: 'care' };
/** earnings-evolution certificate key → `CertificateAmounts` key (`meal_allowance_taxfree` has no counterpart). */
const CERTIFICATE_KEYS = {
  gross: 'grossWage',
  wage_tax: 'wageTax',
  soli: 'soli',
  church_tax: 'churchTax',
  reduced_gross: 'multiYearComp',
  reduced_wage_tax: 'multiYearWageTax',
  reduced_soli: 'multiYearSoli',
  reduced_church_tax: 'multiYearChurchTax',
  pension_employer: 'pensionEmployer',
  pension: 'pensionEmployee',
  health_subsidy: 'employerSubsidyHealth',
  care_subsidy: 'employerSubsidyCare',
  health: 'health',
  care: 'care',
  unemployment: 'unemployment',
};
const KINDS = { regular: 'REGULAR', correction: 'CORRECTION', payout_only: 'PAYOUT_ONLY' };
/** Rejections meaning "not a supported layout" rather than "a supported layout read wrongly". */
const OUT_OF_SCOPE = new Set(['UNSUPPORTED_FORMAT', 'IMAGE_ONLY']);

const { parseDocument, extractPdfText } = await loadParsers();
const reference = JSON.parse(readFileSync(JSON_PATH, 'utf8'));
const pdfs = walk(PDF_DIR).filter((f) => f.toLowerCase().endsWith('.pdf'));

const stats = {
  pdfs: pdfs.length,
  parsed: 0,
  rejected: {},
  /** Files no Vaultfolio parser supports yet (other layouts, scans) — the companion export covers them. */
  outOfScopeFiles: 0,
  outOfScopeReferenceEntries: 0,
  /** earnings-evolution uses its own employer names; Vaultfolio keeps the header name (renameable). */
  employerNameDiffers: 0,
  records: { compared: 0, matched: 0, mismatched: 0, missingInVaultfolio: 0, extraInVaultfolio: 0 },
  certificates: {
    compared: 0,
    matched: 0,
    mismatched: 0,
    missingInVaultfolio: 0,
    extraInVaultfolio: 0,
  },
  fields: {},
  referenceWithoutPdf: 0,
};
const seenSources = new Set();

for (const file of pdfs) {
  const rel = relative(PDF_DIR, file);
  const refRecords = (reference.records ?? []).filter((r) => sameSource(r.source, rel));
  const refCertificates = (reference.certificates ?? []).filter((c) => sameSource(c.source, rel));
  [...refRecords, ...refCertificates].forEach((r) => seenSources.add(r));

  const bytes = readFileSync(file);
  const extracted = await extractPdfText(new Blob([bytes], { type: 'application/pdf' }));
  const outcome =
    'error' in extracted
      ? { ok: false, error: { code: extracted.error } }
      : parseDocument(extracted.text);
  if (!outcome.ok) {
    const code = outcome.error.code;
    stats.rejected[code] = (stats.rejected[code] ?? 0) + 1;
    if (OUT_OF_SCOPE.has(code)) {
      stats.outOfScopeFiles++;
      stats.outOfScopeReferenceEntries += refRecords.length + refCertificates.length;
    } else {
      // A supported document the parser could not read counts against parity.
      stats.records.missingInVaultfolio += refRecords.length;
      stats.certificates.missingInVaultfolio += refCertificates.length;
    }
    if (VERBOSE)
      console.log(
        `  ${rel}: rejected ${code}${refRecords.length + refCertificates.length ? ' (earnings-evolution read it)' : ''}`,
      );
    continue;
  }
  stats.parsed++;
  const differing = new Set();
  compareSets(
    outcome.records,
    refRecords,
    recordKey,
    (ours, ref) => diffRecord(ours, ref),
    stats.records,
    differing,
  );
  compareSets(
    outcome.certificates,
    refCertificates,
    certificateKey,
    (ours, ref) => diffCertificate(ours, ref),
    stats.certificates,
    differing,
  );
  if (VERBOSE && differing.size > 0) console.log(`  ${rel}: ${[...differing].sort().join(', ')}`);
}

stats.referenceWithoutPdf = [
  ...(reference.records ?? []),
  ...(reference.certificates ?? []),
].filter((r) => !seenSources.has(r)).length;
const mismatches =
  stats.records.mismatched +
  stats.records.missingInVaultfolio +
  stats.records.extraInVaultfolio +
  stats.certificates.mismatched +
  stats.certificates.missingInVaultfolio +
  stats.certificates.extraInVaultfolio;

console.log(
  `PDFs: ${stats.pdfs}, parsed: ${stats.parsed}, rejected: ${JSON.stringify(stats.rejected)}`,
);
console.log(
  `not supported yet (other layouts/scans): ${stats.outOfScopeFiles} files, ${stats.outOfScopeReferenceEntries} earnings-evolution entries`,
);
console.log(`employer name differs (informational, renameable): ${stats.employerNameDiffers}`);
console.log(`records: ${JSON.stringify(stats.records)}`);
console.log(`certificates: ${JSON.stringify(stats.certificates)}`);
console.log(`differing fields (count): ${JSON.stringify(stats.fields)}`);
console.log(
  `earnings-evolution entries without a PDF in the directory: ${stats.referenceWithoutPdf}`,
);
console.log(`mismatches: ${mismatches}`);
process.exit(mismatches === 0 ? 0 : 1);

// ------------------------------------------------------------------ comparison

function compareSets(ours, refs, keyOf, diff, counter, differing) {
  const byKey = new Map(refs.map((r) => [keyOf(r, true), r]));
  for (const item of ours) {
    const key = keyOf(item, false);
    const ref = byKey.get(key);
    if (!ref) {
      counter.extraInVaultfolio++;
      differing.add('<extra entry>');
      continue;
    }
    byKey.delete(key);
    counter.compared++;
    const fields = diff(item, ref);
    if (fields.length === 0) counter.matched++;
    else {
      counter.mismatched++;
      for (const f of fields) {
        stats.fields[f] = (stats.fields[f] ?? 0) + 1;
        differing.add(f);
      }
    }
  }
  counter.missingInVaultfolio += byKey.size;
  if (byKey.size > 0) differing.add('<missing entry>');
}

function recordKey(r, isReference) {
  const kind = isReference ? KINDS[r.kind] : r.kind;
  return `${r.period}|${kind}|${r.seq}`;
}

function certificateKey(c) {
  return String(c.year);
}

function diffRecord(ours, ref) {
  const fields = [];
  if (norm(ours.employer) !== norm(ref.employer)) stats.employerNameDiffers++;
  if (ours.issued !== ref.issued) fields.push('issued');
  const a = ours.amounts;
  for (const [snake, key] of Object.entries(AMOUNT_KEYS)) {
    if (!sameCents(a[key], ref.amounts?.[snake])) fields.push(`amounts.${snake}`);
  }
  for (const [snake, key] of Object.entries(PART_KEYS)) {
    if (!sameCents(a.oneOff?.[key], ref.one_off?.[snake])) fields.push(`one_off.${snake}`);
    if (!sameCents(a.ytd?.[key], ytdCents(ref.ytd, snake))) fields.push(`ytd.${snake}`);
  }
  for (const [snake, key] of Object.entries(SUBSIDY_KEYS)) {
    if (!sameCents(a.employerSubsidy?.[key], ref.employer_share?.[snake]))
      fields.push(`employer_share.${snake}`);
  }
  return fields;
}

function diffCertificate(ours, ref) {
  const fields = [];
  if (norm(ours.employer) !== norm(ref.employer)) stats.employerNameDiffers++;
  for (const [snake, key] of Object.entries(CERTIFICATE_KEYS)) {
    if (!sameCents(ours.amounts[key], ref.amounts?.[snake])) fields.push(`certificate.${snake}`);
  }
  return fields;
}

/** earnings-evolution splits some year-to-date figures into `<key>_regular` + `<key>_one_off`. */
function ytdCents(ytd, key) {
  if (!ytd) return undefined;
  if (ytd[key] !== undefined) return ytd[key];
  const regular = ytd[`${key}_regular`];
  const oneOff = ytd[`${key}_one_off`];
  return regular === undefined && oneOff === undefined ? undefined : (regular ?? 0) + (oneOff ?? 0);
}

/** Money string ("1234.56") vs. integer cents; missing/null count as zero on both sides. */
function sameCents(money, cents) {
  const ours = money == null ? 0 : Math.round(Number(money) * 100);
  return ours === (cents ?? 0);
}

function norm(name) {
  return String(name ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function sameSource(source, rel) {
  if (!source) return false;
  const s = source.replaceAll('\\', '/');
  return s === rel || s.endsWith(`/${rel}`) || basename(s) === basename(rel);
}

// ------------------------------------------------------------------ setup

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)],
  );
}

function expandHome(path) {
  return path?.replace(/^~(?=\/|$)/, process.env.HOME ?? '~');
}

/**
 * Bundles the TypeScript parsers and the browser PDF adapter with esbuild (pdfjs-dist stays an
 * external import), then wires the adapter to the Node build of PDF.js — as its spec does.
 */
async function loadParsers() {
  const outDir = join(REPO_ROOT, 'node_modules/.cache/earnings-parity');
  mkdirSync(outDir, { recursive: true });
  const outfile = join(outDir, 'parsers.mjs');
  await build({
    stdin: {
      contents: [
        "export { parseDocument } from '@vaultfolio/earnings';",
        "export { extractPdfText, setPdfJsLoader } from './libs/frontend/domain/earnings/src/lib/pdf/pdf-text-extractor.ts';",
      ].join('\n'),
      resolveDir: REPO_ROOT,
      loader: 'ts',
    },
    bundle: true,
    platform: 'node',
    format: 'esm',
    conditions: ['@org/source'],
    external: ['pdfjs-dist', 'pdfjs-dist/*'],
    outfile,
    logLevel: 'error',
  });
  const mod = await import(pathToFileURL(outfile).href);

  // The adapter reads files with FileReader (browser/jsdom); Node only has Blob.
  globalThis.FileReader ??= class {
    readAsArrayBuffer(blob) {
      blob.arrayBuffer().then(
        (buffer) => ((this.result = buffer), this.onload?.()),
        (error) => ((this.error = error), this.onerror?.()),
      );
    }
  };
  mod.setPdfJsLoader(async () => {
    globalThis.pdfjsWorker = await import('pdfjs-dist/legacy/build/pdf.worker.mjs');
    return import('pdfjs-dist/legacy/build/pdf.mjs');
  });
  return mod;
}
