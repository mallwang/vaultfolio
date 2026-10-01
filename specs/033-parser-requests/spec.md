# Feature Specification: Parser Requests

**Feature Branch**: `033-parser-requests`

**Created**: 2026-10-01

**Status**: Draft

**Design**: [design.md](design.md) — approved mockup covering the import-page offer, the four-step request wizard, refusal reasons, the Administration → Requests tab (table and detail) and the notification e-mails.

**Input**: User description: "Parser requests for the Earnings domain (v1, rebuild instead of upload) plus a generic requests module: when an import is rejected as 'format not supported yet', an entitled user can request a new parser by submitting an anonymized, rebuilt sample of the document and — optionally — rule hints marked in the preview. Administrators see the requests in a new 'Requests' tab under Administration, download the anonymized sample from the portal only (never by e-mail) and are notified by e-mail with a deep link."

## Overview

Today a payslip in an unsupported layout is simply rejected (032, FR-014). The only way forward is for someone to write a new parser — which needs a sample document. Real payslips are personal data and must not reach the server (032, FR-008/FR-009).

This feature closes that gap without giving up the privacy promise in spirit: the user's PDF is still read **only on their own device**. What can leave the device — after explicit consent and after the user has reviewed it — is a **rebuilt, anonymized sample**: the same layout (labels, columns, positions) but with every value replaced by random values of the same shape, and all personal identifiers removed. The server never receives or stores the user's PDF; it receives structured, validated layout data and **generates the sample PDF itself**, so no foreign file ever enters the system.

Requests are modelled generically (feature + request type), so any future feature can raise requests to administrators. "New parser" for the Earnings domain is the first request type.

The user does not need to redact the document first: personal data found on the device is removed automatically from the rebuilt copy and the user confirms the result in a preview. Making a request does **not** create a parser: a developer writes the parser (deterministic, reviewed, versioned code) using the anonymized sample and the user's optional rule hints. The hints are stored for the developer only and are **never executed**.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Request a parser for a document that was not recognized (Priority: P1)

As a user entitled to the Earnings domain whose payslip was rejected as "format not supported yet", I want to offer an anonymized version of that document to the administrators so that support for my payslip format can be built — without handing over my real salary data.

**Why this priority**: This is the feature's purpose. Without it, an unsupported format is a dead end; it is the single path from "my payslip isn't supported" to "it will be".

**Independent Test**: Import a text-based PDF in a layout no parser supports; start the request from the rejection; consent; confirm the anonymized preview; submit. Verify that the request exists with an anonymized PDF and that no value or identifier from the original appears in it or in any network traffic.

**Acceptance Scenarios**:

1. **Given** an entitled user whose imported file was rejected as "format not supported yet", **When** they view the rejection, **Then** they are offered "Request a parser" for that file; the offer is not shown for other rejection reasons (failed arithmetic check, password-protected, unreadable).
2. **Given** the user starts a request, **When** the request screen opens, **Then** it explains in plain language what will be sent (an anonymized rebuilt copy, never the original), what will not be sent, who can see it (administrators), how long it is kept, and requires an explicit consent checkbox before anything can be submitted.
3. **Given** the selected PDF contains personal data detectable by the checks (bank account number, tax ID, social-security number, e-mail address, phone number, postal code with city), **When** it is analysed, **Then** those parts are removed automatically from the anonymized preview (replaced by placeholders the user cannot switch back), and the user sees a notice naming the kinds found (never the data) that they were found and processed only on their own device and are not part of what will be sent; the request is not refused for this reason, and the user still has to review and confirm the preview.
4. **Given** a PDF whose "redaction" is only a black shape drawn over text that is still present in the document, or a document that was not redacted at all, **When** it is analysed, **Then** the user needs no prior redaction or special tool: hidden text is handled like any other text — personal data in it is removed automatically, other words it contains are marked for the user's decision.
5. **Given** the selected PDF is image-only (scan), password-protected or unreadable, **When** it is analysed, **Then** the request is refused with a translated explanation specific to the reason; nothing is submitted.
6. **Given** a PDF that passes the checks, **When** the anonymized preview is built, **Then** every amount, date and digit sequence is replaced by a random value of the same format, right-aligned at the original position; labels from the known payroll vocabulary are kept; every word outside that vocabulary is visibly marked and the user decides per word to keep it as a label or to mask it.
7. **Given** the preview, **When** the user has not decided every marked word, **Then** submitting is not possible; **When** the user confirms the preview, **Then** the request is submitted and the user sees a confirmation; **When** the user rejects the preview, **Then** nothing is submitted and nothing is stored.
8. **Given** a request was submitted, **When** the user later imports another unsupported file, **Then** they can submit another request, subject to the abuse limits (FR-040).

---

### User Story 2 - Handle requests as an administrator (Priority: P1)

As an administrator I want a "Requests" tab under Administration listing every request — from any feature — with what was requested and who asked, so I can download the anonymized sample, track progress and close the request.

**Why this priority**: A request nobody can see or act on is worthless; this is the receiving end and also the generic foundation other features will reuse.

**Independent Test**: With one submitted parser request, open Administration → Requests as an administrator; verify the table row, open the detail, download the anonymized PDF, change the status and add a note. Verify a non-administrator cannot reach the tab, the list, the detail or the download.

**Acceptance Scenarios**:

1. **Given** at least one request exists, **When** an administrator opens Administration → Requests, **Then** a table lists requests with feature, what was requested (e.g. "New parser"), requester, submission date and status, newest first.
2. **Given** the table, **When** the administrator opens a request, **Then** a detail view shows the request data (for a parser request: the anonymized PDF with a download action and the user's rule hints) and lets them set the status (Open, In progress, Done, Rejected) and save a note.
3. **Given** the administrator downloads the anonymized PDF, **When** the download happens, **Then** it is served only to an authenticated administrator, as a download (never rendered inline), with a server-generated file name, and the download is recorded in an audit log.
4. **Given** a link of the form "…/app/admin/requests?id=<request>", **When** an administrator opens it, **Then** the Requests tab opens with that request's detail displayed; for a non-administrator the link gives no access and reveals nothing about the request.
5. **Given** an administrator, **When** they filter or scan the table, **Then** requests of different features and types are distinguishable at a glance; a future feature's request type appears in the same table without changes to the table itself.
6. **Given** a user who is not an administrator, **When** they try any request-list, request-detail or download capability, **Then** access is denied; users can submit requests for features they are entitled to but can never read other users' requests.

---

### User Story 3 - E-mail notifications with deep link, no attachment (Priority: P2)

As an administrator I want to be told when a new request arrives, and as a requesting user I want to know when my request is done, so that nobody has to poll the portal.

**Why this priority**: The feature works without e-mails (admins can open the tab), but notifications are what makes requests get handled and lets users re-import once their format is supported.

**Independent Test**: Submit a request and verify every administrator receives one e-mail in their own language with a link to the request and no attachment; set the request to Done and verify the requester receives a mail asking them to re-import.

**Acceptance Scenarios**:

1. **Given** a request is submitted, **When** it is accepted, **Then** every administrator receives an e-mail in their own e-mail language stating that a new request arrived, what kind (feature and type), and a link to that request in the portal.
2. **Given** that e-mail, **When** it is inspected, **Then** it contains no attachment, no sample content and no figures of any kind — the link is the only way to the sample, and it requires an administrator login.
3. **Given** a request is set to Done, **When** the status changes, **Then** the requester receives an e-mail in their e-mail language that their format should now be supported and asks them to import their document again.
4. **Given** the mail service is unreachable, **When** a request is submitted or completed, **Then** the request/status change still succeeds and the failure is logged without sensitive content; the user is not shown a failure for something that was saved.

---

### User Story 4 - Mark parsing rules in the preview as hints for the developer (Priority: P2)

As a user submitting a request I want to point out in the preview which line is which figure (e.g. "this line is wage tax", "this column is the amount"), so the developer can build the parser faster — and see right away whether my markings make the numbers add up.

**Why this priority**: It is the biggest accelerator for writing the parser, but a request without hints is still useful, so it follows the base flow.

**Independent Test**: In the preview mark the lines of a synthetic payslip with their figure types and columns; verify the live check turns green when the markings are consistent and red when not; submit and verify the hints (labels, positions, formats — no values) are visible to the administrator and nothing is executed.

**Acceptance Scenarios**:

1. **Given** the anonymized preview, **When** the user clicks a line, **Then** they can assign it a figure type — gross, tax gross, wage tax, solidarity surcharge, church tax, health, long-term care, pension, unemployment insurance, statutory net, payout — or mark it "ignore", and indicate whether it is a deduction (sign).
2. **Given** a marked line, **When** the user picks the relevant number, **Then** the column (horizontal range) and number format (e.g. `1.234,56`, cents without separator, trailing minus) are recorded, and the period (month) can be marked where it is printed.
3. **Given** markings, **When** they change, **Then** a live result shows the figures derived from the preview and whether the existing arithmetic checks (statutory net, payout) pass or fail and which figures take part, shown by colour and icon.
4. **Given** the user submits, **When** the request is stored, **Then** the markings are stored as a "rule draft" consisting only of labels, figure types, columns, formats and signs — no figures — and the request can be submitted even when the live check is red or no markings were made.
5. **Given** a stored rule draft, **When** any import runs, **Then** the draft is never executed or used to read any document; it is information for the developer only.

---

### User Story 5 - Retention and cleanup of samples (Priority: P2)

As a user and as the operator I want request samples not to accumulate forever.

**Why this priority**: A privacy-relevant lifecycle rule; required before release, but independent of the main flow.

**Independent Test**: Create requests in each status, advance time past the thresholds, and verify which attachments remain.

**Acceptance Scenarios**:

1. **Given** a request that is Open or In progress, **When** any amount of time passes, **Then** its sample and hints are kept.
2. **Given** a request set to Done or Rejected, **When** 30 days have passed since that status was set, **Then** its sample and rule draft are permanently deleted; the request row (without attachment) remains as history.
3. **Given** a request set back from Done/Rejected to Open or In progress before the 30 days elapsed, **When** time passes, **Then** the deletion countdown is cancelled.
4. **Given** the requester's account is permanently deleted or purged, **When** that happens, **Then** their requests' samples, hints and requester reference are removed with it.

---

### Edge Cases

- **Rejected for another reason**: The request offer appears only for "format not supported yet" (032 FR-014). Documents failing an arithmetic check are a user-correction case (032 FR-012a) and not a parser request.
- **Multi-page documents**: All pages are included up to a page limit; beyond it the user is asked to send only the first pages that show the layout.
- **Very large or crafted submissions**: A submission exceeding size/count limits, using characters or fields outside the strict structure, or carrying anything but plain layout data is rejected by the server regardless of what the browser showed.
- **Personal data survives in the structure**: The browser scans the final preview content again and sending is blocked while anything recognizable remains; the server runs its own personal-data scan on the submitted structure and rejects the request on any hit. Since the browser has already removed such data, a server hit indicates a faulty or manipulated submission.
- **False positive**: A label mistaken for personal data is replaced by a placeholder in the sample; this costs the developer one label but never exposes anything.
- **Names and addresses**: These cannot be reliably told apart from labels by rules. The safeguards are the label vocabulary (anything else is marked, not silently kept) and the mandatory per-word confirmation; the consent text states that the user is responsible for the final review.
- **Duplicate requests**: Submitting the same layout again while a request for it is open is flagged to the user and to the administrators rather than silently piling up; it is not blocked outright.
- **Abuse**: A user exceeding the open-request or daily limits is refused with a translated message; administrators are not flooded by repeated e-mails.
- **Entitlement revoked**: A user who loses Earnings entitlement can no longer submit; their existing requests stay until handled and expire by the normal retention rules.
- **No administrator reachable**: The request is still stored; the missing e-mail is logged; the request is visible in the tab.
- **Administrator removes a request's sample**: Deleting the sample (or its expiry) does not delete the request row or its status history.
- **Download of an expired sample**: The detail shows that the sample has been deleted; no error page.
- **Requester removed**: A request whose requester account was purged no longer exists (US5); no dangling reference to a person remains.
- **Language**: Both administrators' and users' texts and e-mails follow their selected language; the anonymized sample itself keeps the document's original labels.

## Requirements _(mandatory)_

### Functional Requirements

**Request flow (user)**

- **FR-001**: From the "format not supported yet" rejection of an imported file, an Earnings-entitled user MUST be able to start a parser request for that file. The offer MUST NOT appear for other rejection reasons or for users without Earnings entitlement.
- **FR-002**: Before anything can be submitted the user MUST give explicit, per-request consent via a checkbox next to a plain-language explanation of what is sent (an anonymized rebuilt copy), what is never sent (the original PDF, its raw text, personal identifiers), who can see it (administrators), and how long it is kept (FR-038/FR-039).
- **FR-003**: The document MUST be read and analysed only on the user's device. Neither the original PDF nor its unanonymized text MUST be sent to the server or stored anywhere.
- **FR-004**: The system MUST refuse the request, with a translated reason, when the document is image-only, password-protected or unreadable, and MUST NOT submit anything in these cases.
- **FR-005**: The system MUST scan all text of the document — including text hidden under drawn shapes — for personal data (bank account numbers with valid check digits, tax identification numbers with valid check digits, social-security numbers, e-mail addresses, phone numbers, postal code with city) and MUST remove every recognized part automatically from the anonymized copy by replacing it with a placeholder that the user cannot switch back. Recognition MUST also work for values split across several words of a line. The user MUST be told which kinds were found (never the data) and that they were processed only on the device and are not sent. Finding personal data MUST NOT cause the request to be refused, and the user MUST NOT be required to redact the document beforehand. After removal the scan MUST run again over the final preview content, and sending MUST be impossible while anything recognizable remains.
- **FR-006**: The system MUST build an anonymized copy in which every amount, date and digit sequence is replaced by a random value of the same format, placed at the original position (right-aligned to the original right edge for numbers), so the layout and columns are preserved. Exact arithmetic consistency of the random values is not required.
- **FR-007**: Words found in a maintained vocabulary of payroll labels (including those the existing parsers recognise) MUST be kept; every other word MUST be visibly marked in the preview, and the user MUST decide for each marked word to keep it as a label or to mask it. Submitting MUST be impossible until every marked word has a decision. Masked words are replaced by a placeholder of similar length. Words that were covered by a drawn shape in the original SHOULD be preselected as masked.
- **FR-008**: The user MUST see a preview of exactly what the administrators will receive — rendered by the same logic as the final sample — and MUST be able to confirm or reject it. Rejecting MUST discard everything without sending or storing anything.
- **FR-009**: The preview and the user's decisions MUST NOT survive leaving the request page or re-reading the file.

**Rule hints (user)**

- **FR-010**: In the preview the user MUST be able to assign a line a figure type from the set: gross, tax gross, wage tax, solidarity surcharge, church tax, health, long-term care, pension, unemployment insurance, statutory net, payout, or "ignore", and to mark whether it is a deduction.
- **FR-011**: For an assigned line the user MUST be able to select the relevant number, which records its column (horizontal range) and number format (`1.234,56`, cents without separator, trailing minus), and to mark where the period (month) is printed.
- **FR-012**: The preview MUST show, live, the figures derived from the markings and the result of the existing arithmetic checks (statutory net, payout) with the figures taking part highlighted by colour and icon (not colour alone).
- **FR-013**: The markings MUST be stored as a "rule draft" of labels, figure types, columns, formats and signs only — never any figure value — and MUST be optional: a request without markings, or with failing live checks, MUST still be submittable.
- **FR-014**: A rule draft MUST NOT be executed or used to read any document in this version; it is information for the developer only.

**Server handling and security**

- **FR-015**: The server MUST NOT accept PDF files or any binary document in this flow. The browser MUST send only structured layout data (pages, lines, words with text and position, rule draft) in a strict, versioned schema.
- **FR-016**: The server MUST reject any submission that does not match the strict schema, contains fields outside it, or exceeds limits for size, pages, lines, words per line, text length and rule-draft entries, with a translated error.
- **FR-017**: The server MUST run its own personal-data scan (FR-005's kinds) over the submitted structure and MUST reject the request on any hit, regardless of what the browser reported (a hit means a faulty or manipulated submission, since the browser removes such data first).
- **FR-018**: The server MUST generate the sample PDF itself from the validated data. The generated PDF MUST contain only static text and layout — no scripts, actions, links, embedded files, forms, or any content taken over from a user-supplied file — so no foreign file ever enters the system. The sample the administrator downloads MUST look the same as the preview the user confirmed.
- **FR-019**: The generated sample MUST be stored in the portal's database together with its content hash and size; it MUST NOT be reachable through any public or unauthenticated address.
- **FR-020**: The sample MUST be downloadable only through an authenticated administrator capability, served as a download (not displayed inline) with the correct document type, content-type sniffing disabled, and a server-generated file name containing no user-supplied text.
- **FR-021**: Each download of a sample MUST be recorded in an audit log with the administrator, the request and the time, without any sample content.
- **FR-022**: The sample PDF MUST NEVER be sent as an e-mail attachment or embedded in an e-mail; it is available only in the portal.
- **FR-023**: Logs, error reports and diagnostics related to requests MUST NOT contain document text, sample content, rule-draft content or personal identifiers — only request id, feature, type, status, sizes, hashes and error codes.

**Generic requests module**

- **FR-024**: The system MUST provide a generic request capability usable by any feature: a request has a feature, a request type, a requester, a status (Open, In progress, Done, Rejected), a type-specific payload, an optional attachment, the administrator who last handled it with the time, and a note.
- **FR-025**: Features MUST register their request types, each declaring its payload structure, whether and how an attachment is allowed, and its display names in English and German. The registered set MUST live in one shared place consumed by both server and browser.
- **FR-026**: "Earnings / New parser" MUST be the first registered type; its payload is the rule draft and its attachment the generated anonymized sample.
- **FR-027**: Submitting a request of a feature's type MUST require the same entitlement as using that feature; for Earnings this is the Earnings domain entitlement.
- **FR-028**: A request MUST be visible only to administrators (and its requester only through the confirmation they were shown at submission); users MUST NOT be able to list or read requests, including their own, in this version.

**Administration (admin UI)**

- **FR-029**: Administration MUST offer a new "Requests" tab, reachable at its own address, restricted to administrators, in the same tab pattern as the other Administration tabs and available in English and German.
- **FR-030**: The tab MUST show a table with feature, what was requested, requester, submission date and status, newest first, working on phone-width screens and in light and dark themes.
- **FR-031**: Opening a request MUST show its detail: for a parser request the sample download and the rule draft; and MUST allow setting the status and saving a note.
- **FR-032**: A link containing the request's identifier MUST open the tab with that request's detail displayed, for an authenticated administrator; for anyone else it MUST give no access and reveal nothing about the request.
- **FR-033**: Changing a request's status or note MUST record who changed it and when.

**Notifications**

- **FR-034**: On acceptance of a new request every administrator MUST receive one e-mail in their own e-mail language with the kind of request and a link to the request in the portal, and nothing else about its content.
- **FR-035**: When a request is set to Done its requester MUST receive an e-mail in their e-mail language stating the request is done and asking them to import their document again.
- **FR-036**: A failure to send e-mail MUST NOT fail or roll back the request or the status change; it MUST be logged without sensitive content.
- **FR-037**: The e-mail link base MUST be validated as an absolute address before sending, with the validation shared by all existing notification services instead of duplicated in each.

**Retention and abuse**

- **FR-038**: The sample and rule draft of a request MUST be kept while the request is Open or In progress.
- **FR-039**: Thirty days after a request becomes Done or Rejected, its sample and rule draft MUST be permanently deleted by a recurring cleanup; the request row without attachment remains. Setting the request back to Open or In progress MUST cancel the countdown.
- **FR-040**: The system MUST limit how many open requests and how many new requests per day a user may have (defaults: 3 open, 5 per day) and refuse further submissions with a translated message.
- **FR-041**: The system SHOULD detect a request whose sample matches the content hash of an existing open request and flag it as a possible duplicate to the user and in the table, without blocking it.
- **FR-042**: When a user's account is permanently deleted or purged, their requests including samples and rule drafts MUST be removed with it.

**Spec and constitution alignment**

- **FR-043**: This feature MUST amend 032's FR-008 and FR-009 and the constitution's Sensitive Personal Data rules ("no document handling on the server") with a precise, narrow exception: only this opt-in, consented, user-reviewed flow may transmit a derived, anonymized, rebuilt sample; the original PDF and its raw text still never leave the device, personal identifiers are still never transmitted or stored, and no figures from the user's real document are transmitted. The amendment MUST be made, with a version bump, before implementation.
- **FR-044**: The Earnings privacy note, user documentation and operator documentation MUST describe this exception: when it applies, what is sent, who can see it, the retention rule, and that the operator and administrators can see the anonymized sample.

**Language and presentation**

- **FR-045**: All texts of this feature — consent, explanations, refusal reasons, preview labels, figure types, table, detail, status names, e-mails — MUST be available in English and German and follow the user's selected language (administrators' e-mails follow their e-mail language).
- **FR-046**: Interactive elements without a stable visible label (translated-only labels, repeated rows, wrapped components) MUST carry stable test identifiers, per the project's test-id conventions.

### Key Entities

- **Request**: A user's ask to the administrators. Attributes: feature, request type, requester, status (Open / In progress / Done / Rejected), type-specific payload, submission time, last handler and time, note, time the status became Done/Rejected (drives retention), possible-duplicate flag.
- **Request Type**: A registered kind of request owned by a feature. Attributes: feature, type key, payload structure, attachment policy, required entitlement, display names (English, German).
- **Request Attachment**: The generated file belonging to a request. Attributes: request, document type, size, content hash, content, generation time. Deleted by retention (FR-039) while its request remains.
- **Anonymized Sample**: The generated PDF of a parser request: pages of static text at original positions, with random values, kept labels and masked words, never derived from user-supplied file content.
- **Layout Submission**: What the browser sends for a parser request: a versioned, strict structure of pages, lines and words (text plus position) and the rule draft — never a file.
- **Rule Draft**: The user's optional hints for the developer: per marked line the label, figure type, sign, column range and number format, plus the period position. Contains no figures and is never executed.
- **Label Vocabulary**: The maintained list of payroll terms whose words are kept in anonymization (derived from the existing parsers and common German payroll terms).
- **Download Audit Entry**: A record of one administrator download: administrator, request, time.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A user who hits "format not supported yet" can go from the rejection to a submitted request in under 5 minutes for a typical one-page payslip, including reviewing the preview.
- **SC-002**: In 100% of test documents containing a planted bank account number, tax ID, social-security number, e-mail address, phone number or postcode+city — including ones split across words and ones covered only by a black shape — the planted value appears neither in the preview, nor in anything transmitted, nor in the stored sample, and the document is not refused for that reason.
- **SC-003**: Across all accepted requests in testing, 0 characters from the original document's amounts, dates or digit sequences appear in the stored sample, and 0 bytes of the original PDF reach the server (verified by inspecting all traffic).
- **SC-004**: 100% of submissions that are not strictly valid layout data, exceed limits, or contain a personal-data pattern are rejected by the server even when sent without the browser's checks.
- **SC-005**: The stored sample contains no executable or linked content (no scripts, actions, links, attachments, forms) in 100% of generated files.
- **SC-006**: A non-administrator can read, list or download nothing from any request, verified for every request capability; the download works only for administrators, only as a download, and is audit-logged every time.
- **SC-007**: Every administrator receives exactly one new-request e-mail per request in their own language, 0 e-mails contain an attachment or sample content, and the link opens the right request for an administrator.
- **SC-008**: An administrator can open a new request from the e-mail link, download the sample and set the status in under 1 minute.
- **SC-009**: 30 days after a request is Done or Rejected, 100% of its samples and rule drafts are gone, while 0 samples of Open or In-progress requests are removed.
- **SC-010**: A second feature can register a new request type and have its requests appear in the Requests tab without changing the table or the notification mechanism.
- **SC-011**: Every screen, message and e-mail of this feature is fully usable in both English and German with no untranslated text, in light and dark themes and at phone width.
- **SC-012**: For a synthetic payslip with correctly marked lines, the live check in the preview shows all checks passing; with one wrongly marked line it shows the failing check and the involved figures.

## Assumptions

- **Not an automatic parser**: A request never produces a parser by itself; a developer writes it from the sample. A user cannot use their own rule draft to import anything (v2/v3 — a declarative parser built from approved drafts, or local use of rules — are out of scope).
- **Constitution amendment required** (FR-043): Like 032's issue #63 amendment, this must be made before planning is considered final; it narrows, not removes, "no document handling on the server".
- **Variant "rebuild"**: The server generates the PDF; no antivirus engine is needed because no user-supplied file is ever stored or served.
- **Structure over arithmetic**: Random replacement values need not satisfy payroll arithmetic (user decision); the live check in the rule-hint preview runs on the figures derived from the markings of the _original_ document on the device only and nothing derived from real figures is transmitted.
- **No prior redaction needed**: Because only a rebuilt copy is ever sent, users upload the original document; automatic removal plus the mandatory preview replace manual redaction. Detection of personal data is best effort (names and addresses cannot be recognized reliably), so the word decisions and the preview approval remain mandatory.
- **Text-based PDFs only**: Scans/OCR are out of scope; image-only PDFs are refused (032 iteration 3 covers OCR).
- **Retention**: Samples are kept until handled; 30 days after Done/Rejected they are deleted; the request row stays as history. Requests of purged accounts are removed.
- **Requests not self-visible**: In this version users do not get a "my requests" list; they get the submission confirmation and a mail on Done. A user-facing status view can follow.
- **Abuse limits**: Defaults of 3 open and 5 new requests per day per user; operator-configurable values are not required in v1.
- **Administrator visibility**: Administrators see the requester's identity (e-mail) — needed to follow up — but never any of the requester's earnings data (032 FR-003 is unchanged).
- **Label vocabulary**: Seeded from the existing parsers' labels and common German payroll terms and extended over time; its maintenance is a development task.
- **Existing building blocks reused**: Domain entitlement, administrator-only area and tab pattern, shared mail delivery with per-recipient language, scheduled retention cleanup, strict request-size limits per route, and the browser PDF text reader from the Earnings import.
- **Out of scope**: Antivirus scanning, OCR/scans, mathematically consistent random amounts, executing rule drafts, user-facing request list, requests for features other than Earnings (only the mechanism is generic).
