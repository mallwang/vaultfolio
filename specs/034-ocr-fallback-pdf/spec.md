# Feature Specification: OCR Fallback for PDFs Without a Text Layer

**Feature Branch**: `034-ocr-fallback-pdf`

**Created**: 2026-10-02

**Status**: Draft

**Input**: User description: "OCR fallback for payslip/wage-tax PDFs without a text layer (GitHub issue #66): when text extraction finds no readable text, offer on-device text recognition after explicit consent; import via the existing parsers with the row marked as recognised text; allow parser requests for such documents; nothing leaves the device."

## Background

Today a PDF without a readable text layer is refused as "image-only" (032, FR-014; 033, FR-004). This hits genuine scans, but also PDFs whose text was converted to drawn shapes (for example DATEV print output, form LNGN16): they look perfectly readable on screen, yet the user can neither import them nor request a parser. This feature adds an optional, consent-based, fully on-device text recognition (OCR) step so that these documents can follow the same import and parser-request paths as text-based PDFs.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Import a scanned or "text-as-shapes" payslip (Priority: P1)

A user selects a payslip PDF that has no readable text layer. Instead of a dead-end refusal, the app explains that no automatically readable text was found and offers to read the document via text recognition on the device. After the user agrees, progress is shown while the pages are read. If an existing parser recognises the result, the payslip appears in the import preview like any other, clearly marked as "read via text recognition" with a prompt to double-check the figures.

**Why this priority**: This is the core value — documents that are currently unimportable become importable using existing parsers.

**Independent Test**: Select a PDF without a text layer in a supported layout, consent to recognition, and confirm the record reaches the preview with the recognition marker and can be saved after the usual checks pass.

**Acceptance Scenarios**:

1. **Given** a PDF without a text layer in a supported layout, **When** the user selects it, **Then** the app offers text recognition and does not start it before the user explicitly agrees.
2. **Given** the user agrees, **When** recognition runs, **Then** per-page progress is visible and the user can cancel.
3. **Given** recognition finishes and a supported parser matches, **When** the preview opens, **Then** the row is marked as read via text recognition and the user is prompted to verify the figures.
4. **Given** recognised figures that fail the arithmetic plausibility check (gross − deductions = net), **When** the preview opens, **Then** the row is flagged exactly as for text-based PDFs and cannot be saved until corrected or resolved by the same rules as today.
5. **Given** a record from a recognised document is saved, **When** the user later views it, **Then** it is distinguishable as having been imported via text recognition.

---

### User Story 2 - Decline or fail recognition (Priority: P1)

A user who does not want recognition, or whose document yields no text even after recognition, still gets the clear "no automatically readable text" explanation.

**Why this priority**: The fallback must never trap or surprise the user; it preserves today's behaviour as the default.

**Independent Test**: Decline the offer and confirm the refusal message; then run recognition on a blank/unreadable page and confirm the same message.

**Acceptance Scenarios**:

1. **Given** the recognition offer, **When** the user declines, **Then** the existing "no automatically readable text" message is shown and nothing is read.
2. **Given** recognition completes with no usable text, **When** the result is evaluated, **Then** the same message is shown and no record is created.
3. **Given** recognition is running, **When** the user cancels or leaves the page, **Then** it stops and nothing is retained.

---

### User Story 3 - Request a parser for a recognised document (Priority: P2)

When recognition succeeds but no parser matches, the user can submit a parser request for this document through the existing request flow. The preview shows the recognised content so the user can spot recognition errors, anonymise, and include or exclude parts before anything is sent.

**Why this priority**: Closes the loop for unsupported formats among scanned documents; depends on Story 1's recognition step.

**Independent Test**: Recognise a document in an unsupported layout, start a request, and verify the preview shows recognised content with the recognition notice and that sending works only after the existing safeguards pass.

**Acceptance Scenarios**:

1. **Given** a recognised document that matches no parser, **When** the user chooses to request a parser, **Then** the request flow opens with the recognised content (no second consent prompt for recognition itself).
2. **Given** the request preview, **When** it is shown, **Then** it states that the content was recognised automatically and may contain errors.
3. **Given** recognised text where a digit was misread, **When** personal data is detected, **Then** values that are very likely personal identifiers are still removed or flagged even if their check digits are invalid.
4. **Given** the final preview still contains anything recognisable as personal data, **When** the user tries to send, **Then** sending is blocked, and the server's own scan remains an independent second barrier.

---

### User Story 4 - Privacy and documentation stay truthful (Priority: P2)

Users are told, in the offer and in the Earnings privacy note, that recognition runs entirely on their device and that neither file nor text leaves it. Texts exist in German and English, and the user guide and affected specs describe the new behaviour.

**Why this priority**: Trust in the privacy promise is essential for a financial-data product.

**Independent Test**: Run the full flow with network inspection and confirm no request carries document content or text and no model/engine is fetched from an external host; review DE/EN texts and the guide.

**Acceptance Scenarios**:

1. **Given** the full recognition flow, **When** network traffic is observed, **Then** no file or text content is transmitted anywhere and no external resource is fetched at runtime.
2. **Given** the user switches language, **When** any new message is displayed, **Then** it is available in DE and EN.

---

### Edge Cases

- Mixed PDFs: some pages have a text layer, others do not → recognition is offered only if the document as a whole yields no readable text (assumption below).
- Very large or many-page documents: progress remains visible; an upper page limit applies, beyond which recognition is refused with an explanation.
- Low-quality scans or rotated pages: result may be empty or garbled → falls under "no usable text" or fails the plausibility check; never silently imported.
- Misread digits that still pass the plausibility check by chance: the "double-check" marker is the mitigation; the check is not relaxed.
- User closes the tab, switches page or selects another file during recognition → processing stops, nothing persists.
- Password-protected or corrupt PDFs → unchanged refusal; recognition is not offered.
- Device cannot complete recognition (insufficient memory, unsupported browser capability) → clear failure message, fallback to the "no automatically readable text" outcome.
- Recognised document that also contains a real text layer on a later retry → text layer is preferred; recognition is only a fallback.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: When text extraction finds no readable text in a PDF, the system MUST offer text recognition instead of refusing outright, in both the regular import and the parser-request flows.
- **FR-002**: Text recognition MUST start only after the user's explicit consent for that file; consent MUST NOT persist beyond the current file.
- **FR-003**: The system MUST show progress during recognition (at least per page) and MUST allow the user to cancel; cancelling or leaving the page MUST stop processing and discard all intermediate data.
- **FR-004**: Recognition MUST run entirely on the user's device. Neither the file, rendered page images nor recognised text MUST be transmitted or stored server-side, and no external network resource MUST be needed at runtime.
- **FR-005**: Recognition output MUST be converted into the same document-text structure (words with positions, per page) that existing parsers already consume. Existing parsers and the arithmetic plausibility check (gross − deductions = net) MUST remain unchanged and MUST NOT be relaxed for recognised documents.
- **FR-006**: If a supported parser matches the recognised text, the document MUST be imported through the existing preview; each resulting row MUST be marked as read via text recognition and the preview MUST prompt the user to double-check the figures.
- **FR-007**: The recognition marker MUST persist with the saved record so it remains distinguishable later (for example in lists and detail views).
- **FR-008**: If recognition is declined, cancelled, fails, or yields no usable text, the system MUST show the existing "no automatically readable text" message and create nothing.
- **FR-009**: If no parser matches a recognised document, the user MUST be able to submit a parser request through the existing request flow, including preview, anonymisation and include/exclude choices.
- **FR-010**: The request preview MUST state that the content was recognised automatically and may contain errors, and MUST show the recognised content so the user can identify and correct mistakes.
- **FR-011**: Personal-data detection (033, FR-005) MUST remain effective on recognised text, including when recognition errors invalidate check digits of bank account numbers or tax identification numbers: candidates that match the shape of such identifiers MUST still be treated as personal data (removed or flagged) rather than ignored.
- **FR-012**: The post-removal rescan and send-blocking (033, FR-005) and the server-side scan (033, FR-017) MUST apply unchanged to requests derived from recognised text; the server MUST remain tolerant of nothing less than before.
- **FR-013**: Documents that are password-protected or corrupt MUST keep today's refusal; recognition MUST NOT be offered for them.
- **FR-014**: The system MUST enforce a maximum page count for recognition and explain the limit when exceeded.
- **FR-015**: All new user-facing texts (offer, consent, progress, results, markers, errors) MUST exist in German and English.
- **FR-016**: This feature MUST amend 032 FR-014 (image-only message now leads to the recognition offer, the message remains for the declined/no-text case), 033 FR-004 and its "scans/OCR out of scope" statements, and the constitution wording that describes imports as text-based PDFs only. The constitution amendment (with version bump) MUST be made before implementation.
- **FR-017**: The Earnings privacy note, user guide and affected specs MUST describe the recognition fallback and its on-device guarantee.

### Key Entities _(include if feature involves data)_

- **Recognised document text**: The per-page words and positions produced by text recognition; same shape as extracted text, plus an origin indicator ("extracted" vs. "recognised"). Exists only in memory on the device during the session.
- **Recognition marker**: An attribute of an imported earnings record (and its preview row) indicating that its figures came from text recognition and warrant verification.
- **Recognition consent**: A per-file, in-session decision by the user; not persisted.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A payslip PDF whose text is converted to shapes (the DATEV December 2025 sample) can be imported end to end — consent, recognition, preview, save — with all key figures matching the printed values or visibly flagged for correction.
- **SC-002**: Recognition of a typical single-page payslip completes in under 15 seconds on a standard laptop, with progress visible throughout.
- **SC-003**: 100% of records imported from recognised text carry the recognition marker in the preview and after saving.
- **SC-004**: In a full-flow network inspection, zero requests contain document content, rendered images or recognised text, and zero external resources are fetched for recognition.
- **SC-005**: Across a test set of recognised-text samples with injected digit errors in IBANs and tax IDs, no such identifier reaches a sendable request preview or is accepted by the server scan.
- **SC-006**: No previously importable text-based PDF changes behaviour (no recognition offer, identical results).
- **SC-007**: Users who decline recognition receive the same refusal as before in every case.

## Assumptions

- **Early validation spike**: Before planning is finalised, the DATEV sample (December 2025, text as shapes) is run through page rendering plus recognition to confirm amounts and labels are recognised accurately enough for existing parsers. If the result is unusable, scope and the feasibility of User Story 1 are re-evaluated.
- Recognition data (engine and German language data, roughly 10–20 MB) ships with the application, is loaded only when recognition is needed, and requires no runtime network access.
- Only German-language documents are supported initially.
- Recognition is offered only when the whole document yields no readable text; mixed documents are out of scope.
- A page limit in the range of typical payslips and certificates (a handful of pages) is sufficient; exact value is set during planning.
- Marker visibility for saved records can reuse existing row/badge patterns; no new reporting or analytics based on the marker is in scope.
- The companion-tool JSON export remains available and unchanged.
- Out of scope: handwriting, languages other than German, image files (non-PDF), improving existing parsers, and automatic correction of recognition errors.
