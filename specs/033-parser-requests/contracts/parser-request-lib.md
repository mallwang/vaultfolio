# Contract: Library public APIs

Public surface added by this feature. All functions are pure and framework-free (no Angular, no
Nest, no `fs`, no `window`); randomness and time are injected.

## `@vaultfolio/requests` (`libs/requests`, `scope:shared`, data only)

```ts
export const REQUEST_STATUSES = ['OPEN', 'IN_PROGRESS', 'DONE', 'REJECTED'] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];
export const CLOSED_STATUSES: readonly RequestStatus[]; // DONE, REJECTED
export const REQUEST_LIMITS: { open: 3; perDay: 5; retentionDays: 30 };

export interface RequestTypeDefinition {
  /* see data-model.md */
}
export const REQUEST_TYPES: readonly RequestTypeDefinition[]; // first entry: earnings/new-parser
export function findRequestType(feature: string, type: string): RequestTypeDefinition | undefined;
export function requestTypeLabel(
  def: RequestTypeDefinition,
  lang: 'en' | 'de',
): { feature: string; type: string };
```

Rule: this library imports nothing from any feature library. A new feature adds one registry row
(+ a backend handler + an optional admin payload view); table and mail mechanism stay unchanged
(SC-010).

## `@vaultfolio/earnings` additions (`src/lib/parser-request/`)

```ts
// personal-data.ts
export type PersonalDataKind =
  'BANK_ACCOUNT' | 'TAX_ID' | 'SOCIAL_SECURITY' | 'EMAIL' | 'PHONE' | 'POSTCODE_CITY';
export interface PersonalDataHit {
  kind: PersonalDataKind;
  page: number;
  line: number;
  wordIndexes: number[];
}
export function scanLine(
  words: readonly { text: string }[],
): { kind: PersonalDataKind; wordIndexes: number[] }[];
export function scanDocument(doc: {
  pages: { lines: { words: { text: string }[] }[] }[];
}): PersonalDataHit[];

// anonymize.ts
export interface AnalyzedWord {
  text: string;
  x: number;
  width: number;
  height: number;
  covered: boolean;
}
export type WordDecision = 'KEEP' | 'MASK';
export interface AnonWord {
  text: string; // what would be sent for this word right now
  x: number;
  mark: 'LABEL' | 'VALUE' | 'REMOVED' | 'NEEDS_DECISION' | 'MASKED' | 'KEPT';
  locked: boolean; // REMOVED words cannot be switched back
}
export function anonymizeLayout(
  layout: AnalyzedLayout,
  decisions: ReadonlyMap<string, WordDecision>,
  rng: () => number,
): AnonymizedLayout;
export function pendingDecisions(anon: AnonymizedLayout): number; // gate for "Continue"/"Send"
export function toSubmission(
  anon: AnonymizedLayout,
  draft?: SubmittedRuleDraft,
): LayoutSubmissionV1;
export function replaceDigitsSameShape(text: string, rng: () => number): string;

// label-vocabulary.ts
export const LABEL_VOCABULARY: ReadonlySet<string>;
export function isKnownLabel(word: string): boolean;

// layout-submission.ts
export const SUBMISSION_LIMITS: {
  pages: 3;
  linesPerPage: 120;
  wordsPerLine: 40;
  wordsTotal: 3000;
  wordLength: 60;
  ruleLines: 60;
};
export type ValidationResult =
  | { ok: true; value: LayoutSubmissionV1 }
  | {
      ok: false;
      code: 'INVALID_LAYOUT' | 'LAYOUT_UNKNOWN_FIELD' | 'LIMIT_EXCEEDED' | 'INVALID_RULE_DRAFT';
      path: string;
    };
export function validateLayoutSubmission(input: unknown): ValidationResult;

// sheet.ts / sample-pdf.ts
export interface Sheet {
  pages: {
    width: number;
    height: number;
    items: { text: string; x: number; y: number; size: number }[];
  }[];
}
export function toSheet(s: LayoutSubmissionV1): Sheet;
export function renderSamplePdf(sheet: Sheet): Uint8Array; // text-only, Courier, deterministic bytes for a given sheet

// rule-draft.ts
export function deriveRuleLabels(s: LayoutSubmissionV1): StoredRuleDraft; // server: adds `label`, drops nothing else
export const FIGURE_TYPES: readonly FigureType[];

// live-check.ts  (browser-only use; operates on ORIGINAL amounts, result never transmitted)
export interface LiveCheckResult {
  checks: { id: 'NET' | 'PAYOUT'; passed: boolean | null; involved: FigureType[] }[];
  derived: Partial<Record<FigureType, string>>;
}
export function liveCheck(original: AnalyzedLayout, draft: SubmittedRuleDraft): LiveCheckResult;

// layout-fingerprint.ts
export function layoutFingerprintInput(s: LayoutSubmissionV1): string; // canonical string; hashed by the caller (SHA-256)
```

Guarantees covered by tests: `validateLayoutSubmission(toSubmission(x)).ok` for every anonymizer
output; `scanDocument(toSubmission(x))` is empty for every anonymizer output; `renderSamplePdf`
output contains none of the forbidden PDF names and parses with PDF.js to the sheet's text; nothing
in `registry.ts`/`parseDocument` imports `rule-draft.ts` (FR-014).

## Backend interface (`apps/backend/src/requests`)

```ts
export const REQUEST_TYPE_HANDLERS = Symbol('REQUEST_TYPE_HANDLERS');
export interface RequestTypeHandler<P = unknown> {
  readonly feature: string;
  readonly type: string;
  /** Throws a BusinessException with the codes of requests-api.md. */
  validate(payload: unknown): P;
  buildAttachment(valid: P): {
    contentType: 'application/pdf';
    bytes: Uint8Array;
    pageCount: number;
  };
  toStoredPayload(valid: P): Record<string, unknown>;
  fingerprint(valid: P): string;
}
```

## Frontend services

- `RequestsService` (admin lib): `list(status?)`, `get(id)`, `update(id, {status?, note?})`,
  `downloadAttachment(id): Observable<Blob>`.
- `ParserRequestService` (earnings lib): `submit(layout: LayoutSubmissionV1)`; the only network call
  of the wizard.
- `ParserRequestStore` (earnings lib, in-memory): `file`, `analysis`, `decisions`, `ruleDraft`,
  `step`, derived `pendingDecisions`, `removedKinds`, `preview`, `consent`; `reset()` on destroy.

## Test identifiers (FR-046)

Added per `docs/frontend/testid-conventions.md`: `request-parser-button-<index>`,
`request-step-<n>`, `request-consent`, `request-word-<page>-<line>-<index>`,
`request-decision-<key>-keep|mask`, `request-rule-row-<page>-<line>`, `request-send`,
`request-discard`, `admin-tab-requests`, `requests-row-<id>`, `requests-status-filter`,
`request-detail-download`, `request-detail-status`, `request-detail-note`, `request-detail-save`.
