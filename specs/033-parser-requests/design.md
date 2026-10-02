# Design: Parser Requests

**Mockup**: [mockup.html](./mockup.html) (durable local copy) — originally reviewed at
https://claude.ai/artifact/2Pj7KSdUQSGg1pFjKAuVu7 (this remote link may go stale; the local copy is
the source of truth). The mockup was revised once (v2): personal data found in the document is
removed automatically from the preview instead of refusing the request.

## Summary

Two surfaces and two e-mails, all inside the existing authenticated app shell (sidebar + header):

1. **User flow** in the Earnings domain: an entry point on the "format not supported yet" rejection
   of the import page, then a four-step wizard (Consent → Review words → Mark rules → Preview &
   send), then a confirmation.
2. **Administration → Requests**: a new tab with a generic table and a detail view.
3. **E-mails**: an admin alert (link only, no attachment) and a "Done" mail to the requester.

All content in the mockup is invented. The mockup is English only; every string exists in English
and German in the implementation (FR-045).

## Layout per region / screen

### Import page — rejected file with request offer (FR-001)

Per-file rows in the import preview card (existing 032 pattern). Only the row rejected as
"format not supported yet" for a text-based PDF shows a primary **Request a parser** button, with a
one-line explanation that an anonymized copy is sent, never real figures. Rows rejected for a failed
check (correction case, 032 FR-012a) and for image-only scans show no button; the scan row keeps
032's companion-tool message.

### Wizard (FR-002–FR-014)

A stepper under the page title: `1 Consent · 2 Review words · 3 Mark rules (optional) · 4 Preview & send`,
current step highlighted, finished steps checked.

**1 Consent** — a three-column fact row: _Stays on your device_ (success tint), _Sent after you
confirm_ (info tint), _Who sees it, how long_. Below it a card "Document checks (on this device)"
with a status tag; it lists readability, the personal data kinds found (warning, "removed
automatically, no prior redaction needed") and hidden text under black boxes. Then the consent
checkbox in a bordered block, and Cancel / Continue (disabled until the box is ticked).

**Refused (scan, password, unreadable, > 3 pages, limit reached)** — an error callout with the specific _(Amended by 034-ocr-fallback-pdf: scans are no longer refused outright — after the user's per-file consent they are read by on-device text recognition; the refusal remains when the user declines, nothing is recognised, or the document is protected/unreadable.)_
reason, "Choose another file", and a card listing all refusal reasons. Personal data is explicitly
not a refusal reason.

**2 Review words** — an info/warning callout "Personal data was found and removed" (kinds only), a
short explanation, then a two-column split: left the rebuilt page (monospace "sheet", values with a
dotted underline = replaced, personal data as locked grey blocks, unknown words amber with dashed
outline), right a "Marked words" card with a progress bar ("n of 4 decided"), a locked
"Removed automatically" row and one row per unknown word with a Keep as label / Mask segmented
control. Clicking a word on the sheet cycles its decision. Continue stays disabled until every word
is decided. Legend above the sheet explains the four marks.

**3 Mark rules (optional)** — an info callout stating it is optional and not executed. Split: left the
sheet in "rules" mode (rows are clickable, the selected row is highlighted, assigned rows show a
figure-type chip at the right, the chosen number column is outlined); right a "Selected line" card
(figure type select, sign, number column Amount / Year to date, number format, period marking) and a
"Live check" card: a lock note "calculated on this device from your original amounts, never sent",
the derivation (gross − taxes − social insurance = net) and per-check lines with colour **and** icon.
A failing example highlights the involved figure and names the missing marking. Actions: Back,
Skip markings, Continue.

**4 Preview & send** — a success callout "This is exactly what the administrators will receive",
split: left the final sheet, right a Summary card (pages, words kept/masked, personal data removed,
values replaced, number of marked lines, consent) and the actions Send request (primary), Discard
(danger outline), Back.

**Sent** — a success callout (role=status), a key-value card (feature, request, sent time, kept until)
and "Back to import".

### Administration → Requests (FR-029–FR-033)

New tab "Requests" in the Administration tab bar (after Invitations, before General) with a warning
count tag of open requests. Same tab pattern as the other tabs; its own address.

**Table**: Feature · Request · From · Submitted · Status · Open. Newest first, status filter select,
"Possible duplicate" info tag on the request name, new/open rows get a left accent, the Done row shows
when its sample will be deleted. Table scrolls horizontally inside its own container on phones.

**Detail**: back link, title "New parser · Earnings", requester and time, status tag; a duplicate
callout when flagged; two columns: left an _Anonymized sample_ card (Download PDF button in "info"
severity, file name, size and pages, SHA-256, origin note, download audit) and a _Rule hints_ table
labelled "not executed"; right a _Handling_ card (status select, note, Save, retention hint).

### E-mails (FR-034, FR-035)

Admin alert: subject names feature and type, short body, one "Open request" button, the raw link
below it, and an explicit "no attachment, no sample content" note. Requester mail on Done: short text
and a "Go to Earnings import" button.

## Requirement traceability

| Region / screen        | Satisfies                                         |
| ---------------------- | ------------------------------------------------- |
| Import page offer      | FR-001; US1 scenario 1                            |
| 1 Consent              | FR-002, FR-003, FR-004, FR-005; US1 scenarios 2–4 |
| Refused                | FR-004, FR-040; US1 scenario 5; edge cases        |
| 2 Review words         | FR-005, FR-006, FR-007; US1 scenarios 6–7         |
| 3 Mark rules           | FR-010–FR-014; US4                                |
| 4 Preview & send, Sent | FR-008, FR-009, FR-018; US1 scenario 7            |
| Requests table         | FR-029, FR-030, FR-041; US2 scenarios 1, 5        |
| Request detail         | FR-020, FR-021, FR-031–FR-033; US2 scenarios 2–4  |
| E-mails                | FR-022, FR-034, FR-035; US3                       |

## Out of scope for this mockup

- Real PDF rendering: the sheet approximates the rebuilt page; fonts and exact positions come from the
  shared renderer (FR-018).
- Validation and storage rules: strict schema, server-side personal-data scan, limits, retention sweep,
  audit log, duplicate hashing — behaviour, not layout.
- Download behaviour (attachment, content type, no inline display) and the admin-only access rules.
- German texts and the language of e-mails (FR-045).
- The "my requests" list for users (not in v1).

## Visual language

Approximates the PrimeNG Aura preset using the same tokens as the Earnings mockup (032), with light
and dark values. The shell, tabs, buttons, tags and tables are expected to map to PrimeNG components
(Tabs, Button, Tag, DataTable, Select, Checkbox, Message, Stepper); the "sheet" with clickable words
and rows is custom. Exact tokens are taken from the app theme at implementation time. The viewport
toggle in the mockup stands in for breakpoints: below the tablet breakpoint the two-column splits
stack, tables scroll inside their container and the sidebar becomes the top bar.
