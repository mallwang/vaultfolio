# Research: Parser Requests

Phase 0 decisions for [plan.md](plan.md). Each entry: **Decision**, **Rationale**, **Alternatives
considered**. Codebase facts verified against the repository on 2026-10-01. No `NEEDS
CLARIFICATION` remains.

## R1 — Where the logic lives (Nx boundaries)

**Decision**: (a) Earnings-specific pure logic goes into the existing `libs/earnings`
(`scope:shared`) under `src/lib/parser-request/`. (b) A new, tiny, **data-only** library
`libs/requests` (`@vaultfolio/requests`, `scope:shared`) holds the generic registry: statuses,
allowed transitions, and `REQUEST_TYPES` (feature, type key, display names EN/DE, required domain
key as a plain string, attachment policy). It imports nothing from any feature.

**Rationale**: Detectors, anonymizer, validation and PDF writer must run in the browser (FR-003,
FR-005) _and_ on the server (FR-017, FR-018) — only `scope:shared` is reachable from both
`scope:frontend-domain` and `scope:backend`. `libs/earnings` already holds the label source (the
parsers) and the arithmetic checks reused by the live check (FR-012). The registry must be consumed
by backend, admin UI and Earnings without coupling to Earnings (SC-010), hence its own library;
validators are _not_ in it (they are code, registered backend-side per type, R6).

**Alternatives considered**: Everything in `libs/earnings` — admin/backend generic code would
import Earnings. Everything in `libs/requests` — a shared library would own Earnings-specific
logic. A `libs/domain/requests` (`scope:domain`) — unreachable from the browser.

## R2 — Generating the sample PDF (FR-018)

**Decision**: A hand-written minimal PDF writer in `libs/earnings`
(`sample-pdf.ts`): header, catalog, pages tree, one page object per page, one content stream per
page with `BT … Tf … Td … Tj … ET` operators, the **standard Courier font** (Type1, no embedding,
`WinAnsiEncoding`), xref table, trailer. Text is escaped (`\\`, `(`, `)`), restricted to
printable Latin-1; no other object type can be produced by construction (no `/Action`, `/OpenAction`,
`/AA`, `/URI`, `/JS`, `/JavaScript`, `/EmbeddedFile`, `/AcroForm`, `/Annots`, `/Launch`). Courier is
monospace (0.6 em per glyph), so right-aligning a number at the original right edge needs no font
metrics table. The writer takes the **sheet model** (R7) so the browser preview and the PDF come
from one description.

**Rationale**: Guarantees SC-005 structurally, adds no dependency, no font/AFM file reads (pdfkit
reads AFM data via `fs`, fragile under the backend's webpack bundle), runs identically in Node and
the browser (the browser could render the exact bytes for the preview if ever wanted). ~150 lines,
fully unit-testable: tests parse the output with PDF.js and assert text/positions, and scan the
bytes for forbidden names.

**Alternatives considered**: `pdfmake` (already in the repo, but only for browser exports/test
fixtures; server use needs font loading, large bundle, can emit links/attachments). `pdf-lib` — new
dependency, can create actions/attachments. Rendering an image — loses text, useless for developers.

## R3 — Personal-data detection (FR-005, FR-017)

**Decision**: Pure functions in `personal-data.ts`, one detector per kind, run on a **joined line
text with a character→word map**, so a match may span several words and is mapped back to word
indexes (FR-005 "split across words"):

| Kind            | Rule                                                                                                                          |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Bank account    | IBAN: 2 letters + 2 digits + up to 30 alphanumerics, spaces ignored, **mod-97 check** valid                                   |
| Tax ID          | 11 digits, first ≠ 0, digit-multiplicity rule, **ISO 7064 MOD 11,10 check digit** valid (spaces ignored)                      |
| Social security | `12` chars: 2-digit area + 6-digit birth date (DDMMYY plausible) + letter + 2 digits + check digit, **check digit validated** |
| E-mail          | `local@domain.tld` pattern                                                                                                    |
| Phone           | `+`/`0` prefixed 8–15 digit groups with spaces, `/`, `-`, `()`; at least 8 digits                                             |
| Postcode + city | 5 digits followed by a capitalised word (`80331 München`) as adjacent words                                                   |

`scanDocument(layout)` returns `{kind, page, line, wordIndexes}[]`. The browser removes hits
(placeholder words flagged `locked`), then **re-scans the final preview**; send is disabled while
any hit remains. The server runs the same `scanDocument` over the submitted words and rejects with
`PERSONAL_DATA_DETECTED` on any hit (kinds in the log, never text). Because every digit sequence is
replaced by random digits _before_ the re-scan, a random value could in theory form a valid
IBAN/tax ID; the anonymizer therefore **re-rolls** any replaced word until the scan is clean
(bounded retries, then falls back to `0` fill), so browser and server verdicts stay identical.

**Rationale**: Check-digit validation keeps false positives (payslip amounts, personnel numbers) low;
the same module on both sides means "server hit = manipulated submission" (spec edge case).

**Alternatives considered**: Regex only (many false positives on figures). Server-only detection
(violates FR-003: raw text would have to be sent). A third-party PII library (dependency, not
deterministic for German formats).

## R4 — Reading layout and hidden text on the device (FR-004–FR-007)

**Decision**: Extend the existing PDF.js adapter with `extractLayout(file)` in
`libs/frontend/domain/earnings/src/lib/parser-request/layout-extractor.ts`. It reuses the same
line grouping (±2 pt) and word splitting as `extractPdfText` and additionally returns per page:
page `width`/`height`, per word `x`, `y`, `width`, `height` (font size), and `covered: boolean`.
`covered` is computed from `page.getOperatorList()`: filled axis-aligned rectangles
(`constructPath` + `fill`) whose fill colour is dark (luminance < 0.2) and which contain ≥ 80 % of
a word's box. Image-only, password-protected and unreadable files map to the existing error codes _(Amended by 034-ocr-fallback-pdf: scans are no longer refused outright — after the user's per-file consent they are read by on-device text recognition; the refusal remains when the user declines, nothing is recognised, or the document is protected/unreadable.)_
(FR-004). Pages beyond the limit (3) are refused with `TOO_MANY_PAGES` so the user can pick another
file (edge case). All text — including covered text — enters the same pipeline; covered words that
are not personal data are **preselected as masked** (FR-007 SHOULD).

**Rationale**: PDF.js text content ignores shapes, so hidden text is already extracted; only the
"was it covered" hint needs the operator list, and it is a SHOULD — if the operator list yields
nothing, behaviour degrades to "no preselection", never to a leak (every non-vocabulary word still
needs an explicit decision).

**Alternatives considered**: Rasterising pages to detect black boxes (heavy, imprecise). Ignoring
covered text (would silently drop words the user cannot see in the preview).

## R5 — Transport, limits and body size (FR-015, FR-016)

**Decision**: `POST /requests` with `application/json` only. `configureBodyParsers` gets
`app.use('/requests', json({ limit: '512kb' }))` ahead of the global 100 kB parser (same pattern as
`/earnings/imports`). The handler validates with a strict hand-written validator (the repo has no
class-validator; the Earnings validation does the same): exact key sets (unknown keys →
`LAYOUT_UNKNOWN_FIELD`), types, finite numbers within page bounds, text length ≤ 60, characters
restricted to printable Unicode letters/digits/punctuation (no control chars, no `‮`-style
bidi/format chars), and the limits **≤ 3 pages, ≤ 120 lines/page, ≤ 40 words/line, ≤ 3 000 words
total, ≤ 60 rule-draft lines, schema v1**. Binary content types are rejected by the router
(non-JSON → 415).

**Rationale**: A stricter, smaller route limit than imports keeps abuse cheap to reject; numbers
chosen from a dense A4 payslip (~60 lines × ~12 words) with generous headroom.

**Alternatives considered**: Multipart upload (accepts binary; forbidden by FR-015). Zod/class-validator
(new dependency for one route).

## R6 — Generic module shape on the backend (FR-024–FR-028)

**Decision**: `apps/backend/src/requests/` with controller (admin list/detail/update/download +
member submit), service, repository, mail service, retention service. Per-type behaviour is a
`RequestTypeHandler` interface `{ feature, type, validate(payload): ValidatedPayload,
buildAttachment(validated): {contentType, bytes, pages}, toStoredPayload(validated): object,
fingerprint(validated): string }`, registered through a Nest multi-provider token
(`REQUEST_TYPE_HANDLERS`). The service looks up the handler by `(feature, type)` from the shared
`REQUEST_TYPES` registry, rejects unknown types (`UNKNOWN_REQUEST_TYPE`), checks the user holds the
registry's `requiredDomain` in `RequestUser.domainScopes` (admins pass like `DomainGuard`; FR-027),
then delegates. The Earnings handler lives in `handlers/earnings-new-parser.handler.ts` and is
provided by `RequestsModule` (a second feature adds a handler + a registry row; table and mail
mechanism are untouched, SC-010).

**Rationale**: `@RequiresDomain` is static per route, but the domain depends on the request body's
feature, hence the explicit service-level check using the same rule as `DomainGuard`.

**Alternatives considered**: One endpoint per feature (duplicates admin read path). Dynamic guard
resolving the feature from the body (couples guard to body parsing).

## R7 — Sheet model = single description for preview and PDF (FR-008, FR-018)

**Decision**: `sheet.ts` defines `Sheet = { pages: { width, height, items: { text, x, y, size }[] }[] }`
and `toSheet(layoutSubmission)`. The browser `SheetComponent` renders items absolutely positioned
(monospace, same `size`, same coordinates) with the interaction layer (word marks, locked blocks,
row selection) on top; the server `renderSamplePdf(sheet)` writes the same items. A frontend spec
asserts that for a fixture the PDF.js text positions of the generated PDF equal the sheet items
within 0.5 pt ("the sample looks like the preview").

**Rationale**: One model makes "exactly what the administrators receive" testable instead of
promised.

**Alternatives considered**: Rendering the preview from the PDF bytes with PDF.js (heavier, no
click targets per word).

## R8 — Anonymization rules (FR-006, FR-007)

**Decision**: `anonymize.ts`: per word — (1) personal-data hit → locked placeholder (`X` × length,
min 3); (2) contains a digit → **same-shape random replacement** (each digit → random digit, leading
digit of a multi-digit number non-zero, separators `.`/`,`/`-`/`/`/`:` and letters kept; dates keep
their shape; the `n,nn` decimal shape preserved) with the right edge preserved
(`x' = x + width − len·charWidth` for numbers); (3) lower-cased, punctuation-trimmed word in
`LABEL_VOCABULARY` → kept; (4) otherwise `needsDecision` (user: keep or mask; mask →
lower-case `x` × length, capped 3..20; default undecided; preselected masked when `covered`).
Randomness from `crypto.getRandomValues`; the function takes an injectable RNG for deterministic
tests. The vocabulary is seeded by a build-time-free helper that unions the labels used by the four
parsers' registries plus a curated list of common German payroll terms (`Brutto`, `Netto`,
`Lohnsteuer`, `Solidaritätszuschlag`, `Kirchensteuer`, `Krankenversicherung`, …), stored as a
sorted constant array with a unit test that every parser label is covered.

**Rationale**: Per-word decisions plus a closed vocabulary make names/addresses never silently
kept (spec edge case "Names and addresses").

**Alternatives considered**: Masking everything non-numeric (useless layout for developers).
A statistical name detector (non-deterministic, unreliable).

## R9 — Rule draft and live check (FR-010–FR-014)

**Decision**: `rule-draft.ts` defines `RuleDraft = { lines: RuleLine[]; period?: PeriodMark }`;
`RuleLine = { page, line, figure, deduction, column?: {x0,x1}, format?: 'DE_DECIMAL'|'CENTS'|'TRAILING_MINUS' }`;
`figure ∈ {GROSS, TAX_GROSS, WAGE_TAX, SOLIDARITY, CHURCH_TAX, HEALTH, CARE, PENSION, UNEMPLOYMENT, NET, PAYOUT, IGNORE}`.
It contains **no figures and no label text**: labels are derived **server-side** from the
validated layout line (non-digit words only) when storing, so a client cannot smuggle text via the
draft. `live-check.ts` runs **only in the browser** against the **original** amounts: it maps
marked lines/columns/formats to a partial `PayRecordInput.amounts` (using `parseGermanAmount` etc.)
and calls the existing `runRecordChecks`/`runPayoutCheck`, returning per-check status plus involved
figure keys for colour+icon highlighting. Nothing derived from real figures is transmitted
(Assumption "Structure over arithmetic"). The draft is stored as JSON `payload` and never read by
any parser/import code path (FR-014; a unit test asserts `registry.ts` has no import of it).

**Rationale**: Reuses the tested checks; keeps the draft structurally incapable of carrying values.

**Alternatives considered**: Sending live-check results (leaks derived real figures). Free-text
labels from the client (injection/PII channel).

## R10 — Storage, download, audit (FR-019–FR-021)

**Decision**: Sample stored as `BLOB` in `request_attachments` (1:1 with the request) with
`content_type='application/pdf'`, `size_bytes`, `sha256`, `page_count`. Download route
`GET /requests/:id/attachment` (`@Roles(ADMIN)`) streams the BLOB with
`Content-Type: application/pdf`, `Content-Disposition: attachment; filename="request-<first 8 of id>-sample.pdf"`,
`X-Content-Type-Options: nosniff`, `Cache-Control: no-store`; it writes a row into
`request_download_audit` (`request_id`, `admin_id`, `downloaded_at`) in the same transaction as
reading the attachment. The admin UI downloads through `HttpClient` as a Blob and triggers a
download (cookie session, no public URL). Not encrypted at rest: it is anonymized and meant for
administrators/developers (documented in the privacy note, FR-044).

**Rationale**: SQLite BLOB keeps the single-file backup property (Technology constraint); no
filesystem path means nothing is reachable by URL guessing.

**Alternatives considered**: Files on disk (breaks the single bind-mounted file rule's backup
simplicity). Signed URLs (unneeded; adds a secret).

## R11 — Retention and account purge (FR-038, FR-039, FR-042)

**Decision**: `requests.closed_at` is set when the status becomes DONE/REJECTED and cleared when it
returns to OPEN/IN_PROGRESS (cancels the countdown). `RequestsRetentionService` mirrors
`RetentionSweepService` (`setInterval` hourly, `.unref()`): for rows with
`closed_at <= now − 30 days AND payload_purged_at IS NULL` it deletes the attachment row, sets
`payload = NULL` and `payload_purged_at = now`, in one transaction; the row remains as history.
The "now" and the 30-day constant are injectable for tests. `UsersRepository.deleteById` additionally
deletes the user's `requests`, their `request_attachments` and `request_download_audit` rows, and
sets `request_download_audit.admin_id = NULL` / `requests.handled_by = NULL` when the deleted user
was an administrator (same audit-trail treatment as `invitations.invited_by`).

**Rationale**: Reuses the established sweep pattern; no scheduler dependency (`@nestjs/schedule`
is not installed).

**Alternatives considered**: SQLite triggers (hides logic from tests). A cron library (new dependency).

## R12 — Abuse limits and duplicate detection (FR-040, FR-041)

**Decision**: Limits enforced in the service before validation work: **open** = count of the
user's requests with status OPEN/IN_PROGRESS (≥ 3 → `REQUEST_LIMIT_OPEN`), **daily** = count with
`created_at` in the last 24 h (≥ 5 → `REQUEST_LIMIT_DAILY`), both HTTP 429 with translated-by-code
messages on the client. Defaults are constants in `libs/requests`.
**Duplicate fingerprint**: because every value in the sample is random, a hash of the _PDF_ never
matches a second submission of the same layout. The fingerprint is therefore SHA-256 of a canonical
string of the layout with values normalised (digits → `0`, masked words → `x`, coordinates rounded
to 5 pt) — computed by `layout-fingerprint.ts` in the handler. `requests.possible_duplicate` is set
at submit time when another OPEN/IN_PROGRESS request (any user) has the same fingerprint; the user
sees a non-blocking hint in the confirmation and admins see the tag. The PDF SHA-256 is still
stored and shown for integrity (FR-019). _Note: this refines FR-041's "content hash" to what can
actually match._

**Rationale**: Works for the intended case (two users with the same employer layout) without
leaking anything.

**Alternatives considered**: PDF hash (never matches). No duplicate detection (spec SHOULD).

## R13 — E-mails and the shared URL validation (FR-022, FR-034–FR-037)

**Decision**: Two new notification types `request-admin-alert` (`{ featureName, typeName, requestUrl }`)
and `request-done` (`{ importUrl }`) with EN/DE subject/text/html templates in
`libs/notifications`, rendered per recipient language (`emailLanguage`). The view models contain
**no sample content or figures** and there is no attachment parameter in `MailerSendRequest` usage.
`RequestsEmailService` sends to every active admin with `Promise.allSettled`, logging per-failure
metadata only; both sends run **after** the DB commit and never throw into the request/status
transaction (FR-036). Admin link: `${APP_BASE_URL}/app/admin/requests?id=<id>`; requester link:
`${APP_BASE_URL}/app/earnings/import`. The duplicated `requireAbsoluteUrl` logic in
`profile/email.service.ts`, `signups/email.service.ts` and `invitations/email.service.ts` is
extracted into `apps/backend/src/mail/absolute-url.ts` (with its unit test) and all four services
use it (FR-037). "Exactly one mail per admin per request" holds because the mail is sent once from
`submit()`, not from retries; the DONE mail is sent only on a transition _into_ DONE.

**Alternatives considered**: Generalising into one `EmailService` (the earlier specs deliberately
kept per-module services; only the URL helper is shared). Queueing mails (no queue infrastructure).

## R14 — Frontend structure (US1, US4, US2)

**Decision**: Wizard as a lazy route `earnings/import/request` (declared before `earnings/import`'s
siblings, guarded like the import route) hosting a PrimeNG `p-stepper` (steps Consent · Review words
· Mark rules · Preview & send). A root-provided `ParserRequestStore` (signals) holds the selected
`File`/analysis/decisions/marks **in memory only**; leaving the route (or reload) clears it
(`ngOnDestroy` + a route-level guard that redirects to the import page when the store is empty,
FR-009). The import page's rejected-file row shows **Request a parser** only for
`UNSUPPORTED_FORMAT` of a text-based PDF (not for failed checks, image-only, password, unreadable)
and hands the `File` to the store. The custom `SheetComponent` renders words/rows as absolutely
positioned buttons (keyboard-operable, `data-testid`s per FR-046); status uses colour **and** icon.
Admin: new tab `requests` between Invitations and General in `AdminComponent`, child route
`/app/admin/requests` reading `?id=` to open the detail; a `payload-views` map keyed
`feature/type` renders the rule-hints table for `earnings/new-parser` and a generic fallback for
unknown types; the open-count tag comes from the list response. Texts in
`requests.{en,de}.ts` translation files (pattern of `earnings.{en,de}.ts` + its completeness spec).

**Alternatives considered**: Modal dialog wizard (too cramped for the two-column sheet, mockup is
full page). Persisting wizard state (forbidden by FR-009).

## R15 — Testing strategy

**Decision**: Unit (exact values): each detector with valid/invalid/split-across-words cases using
documented example identifiers (e.g. the well-known `DE89 3704 0044 0532 0130 00` IBAN, invented
tax-ID/SSN values with correct check digits generated in the spec); anonymizer shape/alignment/
re-roll; validator limits and unknown fields; PDF writer (PDF.js parse-back, forbidden-token byte
scan, escaping); fingerprint stability; rule-draft + live check pass/fail (SC-012). Backend e2e
(`requests.e2e-spec.ts`): submit OK/invalid/oversized/PII/unknown type/not entitled/limits, list/
detail/patch/download as admin vs member (403) vs anonymous (401), headers, audit rows, Done mail
once, mail failure does not fail the request, retention sweep with injected clock incl. reopen,
account purge, duplicate flag, link `?id=`. Mail: rendered text/html contains link and no
attachment. Frontend: store, steps, sheet interaction, refused states, admin table/detail/filter,
tab route; translation completeness. UI: `verify-ui` Playwright drive of both flows (phone width,
light/dark). SC-003 traffic check: a spec asserts the only HTTP call during the wizard is the final
`POST /requests` whose body contains none of the planted original strings.

## R16 — Constitution amendment text (FR-043, task T001)

**Decision**: Constitution **3.6.0 → 3.7.0 (MINOR)**, applied through `/speckit-constitution`
**before any implementation task**. Replace the Sensitive Personal Data bullet "No document
handling on the server" by: _original documents and their extracted text MUST NOT be transmitted
to or stored by the backend. The single exception is an opt-in, explicitly consented,
user-reviewed flow that transmits a **derived, anonymized, rebuilt sample** (structured layout data
only; every value replaced by a random value of the same shape; personal identifiers removed and
re-checked on the server) for the sole purpose of letting a developer build a parser; such a sample
is stored only for administrators, never e-mailed, and deleted 30 days after the request is closed._
Also: Product Scope → In Scope gains "Earnings: parser requests (033)"; Governance date; Sync
Impact Report. Spec 032's FR-008/FR-009 get a one-line pointer to this exception. User and operator
docs and the in-app Earnings privacy note are updated (FR-044).

**Alternatives considered**: Leaving the constitution untouched (plan would knowingly violate its
intent). Dropping server storage (feature impossible).
