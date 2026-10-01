# Contract: `@vaultfolio/earnings` (libs/earnings) public API

Framework-free TypeScript library, tagged `scope:shared` (research R1). No Angular, NestJS, DOM, or
Node-only imports; only dependency: `decimal.js`. Consumed by `libs/frontend/domain/earnings`
(parsing + preview pre-checks) and `apps/backend` (validation, checks, aggregation). Every export
below is covered by unit tests with exact-value assertions (Principle III) and by integration tests
at the text/JSON boundary (Principle IV).

## Input model for parsers

```ts
/** Output of the browser PDF adapter (libs/frontend/domain/earnings), input of every parser. */
interface PdfDocumentText {
  pages: PdfPageText[];
}
interface PdfPageText {
  lines: PdfLine[]; // top-to-bottom
}
interface PdfLine {
  text: string; // words joined by single spaces
  words: { text: string; x: number; width: number }[]; // for column-sensitive parsing
  y: number;
}
```

## Parsers

```ts
type DocumentType = 'PAYSLIP' | 'CERTIFICATE';

interface EarningsParser {
  id: string; // 'sap-entgeltnachweis' | 'lohnsteuerbescheinigung'
  version: string; // semver; bumped on any behavior change
  documentType: DocumentType;
  detect(doc: PdfDocumentText): boolean;
  parse(doc: PdfDocumentText): ParseOutcome;
}

type ParseOutcome =
  | { ok: true; employer: string; records: PayRecordInput[]; certificates: CertificateInput[] }
  | { ok: false; error: ParseError; partial?: ParsedFigures }; // partial only for CHECK_FAILED (FR-012a)

interface ParsedFigures {
  employer: string;
  records: PayRecordInput[];
  certificates: CertificateInput[];
}

interface ParseError {
  code:
    | 'UNSUPPORTED_FORMAT'
    | 'IMAGE_ONLY' // set by the adapter, listed here for one code space
    | 'PASSWORD_PROTECTED' // set by the adapter
    | 'UNREADABLE' // set by the adapter
    | 'MISSING_FIELD' // params: { field, period? }
    | 'UNKNOWN_LINE' // params: { label, period } — unknown statutory deduction line
    | 'CHECK_FAILED'; // params: { check, period, difference }
  params?: Record<string, string>;
}

const PARSER_REGISTRY: readonly EarningsParser[]; // ordered: certificate, SAP
function parseDocument(
  doc: PdfDocumentText,
): ParseOutcome & { parserId?: string; parserVersion?: string };
```

`parseDocument` picks the first parser whose `detect` returns true, runs `parse`, then runs
`runRecordChecks` on every record and `runPayoutCheck` per payslip; any failing check turns the
outcome into `{ ok: false, error: CHECK_FAILED, partial }` (FR-012); `partial` carries the parsed
figures so the preview can show and correct them (FR-012a).

## Companion export reader

```ts
function readEarningsExport(
  json: unknown,
): ParseOutcome & { parserId: 'earnings-export'; parserVersion: '1' };
// errors: EXPORT_UNSUPPORTED_VERSION, EXPORT_UNKNOWN_FIELD (params.path), INVALID_VALUE (params.path), CHECK_FAILED
```

## Model

```ts
type Money = string; // canonical decimal, 2 dp
type RecordKind = 'REGULAR' | 'CORRECTION' | 'PAYOUT_ONLY';

interface PayRecordInput {
  employer: string;
  period: string;
  issued: string;
  kind: RecordKind;
  seq: number;
  amounts: PayRecordAmounts; // see data-model.md (without `checks`)
  corrected?: PayAmountKey[]; // names of user-corrected figures (FR-012a); never values
}
interface CertificateInput {
  employer: string;
  year: number;
  amounts: CertificateAmounts;
}
```

## Validation and checks

```ts
function validateImportFile(
  file: unknown,
): { ok: true; value: ImportFileInput } | { ok: false; error: ParseError };
// strict whitelist: unknown keys → EARNINGS_UNKNOWN_FIELD; format rules from data-model.md

/** Every failing check of a file, with the figures taking part (FR-012a). */
interface CheckFailure {
  check: 'NET' | 'PAYOUT';
  period: string;
  difference: Money; // signed, as in CheckResult
  recordIndexes: number[]; // records the check covers (payslip sections for PAYOUT)
  involved: { recordIndex: number; key: PayAmountKey }[]; // figures that take part
}
function collectCheckFailures(records: readonly PayRecordInput[]): CheckFailure[];

/** Editable figures of a file = the `involved` figures of its failing checks. */
const EDITABLE_KEYS: readonly PayAmountKey[]; // gross, wageTax, soli, churchTax, health, care, pension, unemployment, net, payout
function editableKeys(
  failures: readonly CheckFailure[],
): { recordIndex: number; key: PayAmountKey }[];

/** Canonical money from user input (`"1.234,56"`, `"-45,00"`, `"1234.56"`) or `null`. */
function parseMoneyInput(text: string): Money | null;

/** Pure: new records with one figure replaced and `corrected` extended; `null` if the key is not editable. */
function applyCorrection(
  records: readonly PayRecordInput[],
  edit: { recordIndex: number; key: PayAmountKey; value: Money },
  editable: readonly { recordIndex: number; key: PayAmountKey }[],
): PayRecordInput[] | null;

function runRecordChecks(r: PayRecordInput): CheckResult[]; // NET: gross − taxes − social = net (±0.01)
function runPayoutCheck(sections: PayRecordInput[]): CheckResult; // PAYOUT: Σ(net + other) = payout (±0.01)
interface CheckResult {
  code: 'NET' | 'PAYOUT' | string;
  passed: boolean;
  difference: Money;
}
```

## Aggregations (backend read models)

```ts
function monthlySeries(records: StoredRecord[]): MonthlyPoint[];
function yearlySeries(records: StoredRecord[]): YearlyPoint[];
function careerSummary(records: StoredRecord[], employers: EmployerRef[]): CareerEntry[];
function latestYearComparison(records: StoredRecord[]): LatestYear | null;
function monthGrid(records: StoredRecord[]): MonthGrid;
function taxesPerYear(records: StoredRecord[]): TaxYearRow[];
function dataCheck(records: StoredRecord[], certificates: StoredCertificate[]): DataCheckRow[];
```

Result shapes are exactly the read-model types in [earnings-api.md](earnings-api.md) (declared once
in `libs/api-contract`, imported here — `api-contract` is `scope:shared`).
