# Vaultfolio User Guide

> Diese Anleitung ist auch auf Deutsch verfügbar: [Deutsche Benutzeranleitung](user-guide.de.md)

Vaultfolio is a self-hosted personal finance tracker. You manage your investment
portfolio manually — no bank or brokerage connections. All data lives in your own
infrastructure.

---

## Table of Contents

1. [Getting Access](#1-getting-access)
   - 1.1 [Self-Service Sign Up](#11-self-service-sign-up)
   - 1.2 [Invitation-Based Sign Up](#12-invitation-based-sign-up)
   - 1.3 [Forgotten Password](#13-forgotten-password)
2. [Navigation](#2-navigation)
   - 2.1 [Sidebar](#21-sidebar)
   - 2.2 [Header](#22-header)
3. [Dashboard](#3-dashboard)
4. [Holdings](#4-holdings)
   - 4.1 [The Holdings List](#41-the-holdings-list)
   - 4.2 [Adding a Holding](#42-adding-a-holding)
   - 4.3 [Asset Types and Their Fields](#43-asset-types-and-their-fields)
   - 4.4 [Distribution Charts](#44-distribution-charts)
   - 4.5 [Editing and Deleting Holdings](#45-editing-and-deleting-holdings)
   - 4.6 [Exporting Holdings Data](#46-exporting-holdings-data)
5. [Account Overview](#5-account-overview)
6. [Klaro](#6-klaro)
7. [Earnings](#7-earnings)
   - 7.1 [Access and Privacy](#71-access-and-privacy)
   - 7.2 [Importing Documents](#72-importing-documents)
   - 7.3 [Overview, Tables and Month Detail](#73-overview-tables-and-month-detail)
   - 7.4 [Data Check](#74-data-check)
   - 7.5 [Imports, Renaming and Deleting](#75-imports-renaming-and-deleting)
   - 7.6 [Requesting a Parser](#76-requesting-a-parser)
     7a. [Retirement](#7a-retirement)
   - 7a.1 [Entering Your Data](#7a1-entering-your-data)
   - 7a.2 [Overview and Tabs](#7a2-overview-and-tabs)
   - 7a.3 [Privacy, Export and Deleting](#7a3-privacy-export-and-deleting)
     7b. [Wealth](#7b-wealth)
   - 7b.1 [Recording Snapshots](#7b1-recording-snapshots)
   - 7b.2 [Development, Balance Sheet and Tile](#7b2-development-balance-sheet-and-tile)
   - 7b.3 [Export, Privacy and Deleting](#7b3-export-privacy-and-deleting)
8. [Settings](#8-settings)
   - 8.1 [Profile](#81-profile)
   - 8.2 [Preferences](#82-preferences)
9. [Admin Area](#9-admin-area)
   - 9.1 [Managing Accounts](#91-managing-accounts)
   - 9.2 [Invitations](#92-invitations)
   - 9.3 [Sign-Up Requests](#93-sign-up-requests)
   - 9.4 [Parser and Other Requests](#94-parser-and-other-requests)
   - 9.5 [System Health](#95-system-health)

---

## 1. Getting Access

### 1.1 Self-Service Sign Up

Navigate to `/signup` and fill in your email address, a password (8–200 characters),
and complete the bot-protection check. After submitting:

1. You will receive a verification email — click the link to confirm your address.
2. Your request enters the admin review queue. An administrator must approve it
   before you can sign in.
3. Once approved, you will receive a confirmation email and can sign in normally.

> **Note:** Your account is not active until both steps are complete. If you do not
> receive the verification email within a few minutes, check your spam folder.

### 1.2 Invitation-Based Sign Up

Administrators can invite users directly. You will receive an invitation email with
a link. Click it to set your own password — the administrator never sees it. Your
account is activated immediately after accepting.

Invitation links expire. If your link has expired, ask an administrator to resend
the invitation.

### 1.3 Forgotten Password

On the sign-in page, click **Forgot your password?**. Enter your email address and
check your inbox for a reset link. The link is single-use and expires after 24 hours.

---

## 2. Navigation

### 2.1 Sidebar

The sidebar lists all areas you have access to. Click the toggle at the bottom to
collapse it to icon-only mode; hovering an icon shows a tooltip with the area name.
The active page is highlighted.

Which areas appear depends on the domains your administrator has granted you access
to (see [Managing Accounts](#91-managing-accounts)).

### 2.2 Header

The header is always visible. It contains:

| Element           | What it does                                        |
| ----------------- | --------------------------------------------------- |
| Logo              | Returns to the dashboard                            |
| Language switcher | Switches the UI display language (English / German) |
| Theme toggle      | Switches between light and dark mode                |
| Your name         | Displays your display name and role badge           |
| Sign Out          | Ends your session                                   |

> **Display language vs. email language:** The language switcher changes what you
> see in the UI. To change the language of emails you receive from Vaultfolio, go
> to **Settings → Preferences**.

---

## 3. Dashboard

The dashboard is your home screen after signing in. It is designed to show summary
widgets from the domains you use — for example, a total portfolio value card. Some
widgets only appear once you have added data. The dashboard is still being expanded
with each new domain.

**Arranging your dashboard.** Drag a tile by the handle in its top-right corner to move it
(or focus the handle and use the arrow keys). Choose **Edit dashboard** above the tiles to switch
individual tiles on or off. A tile for a feature that is disabled for your account stays in its
place as a placeholder; its switch is greyed out — ask your administrator to enable the feature.
Your arrangement is saved in this browser only, per account, and **Reset** restores the default.

---

## 4. Holdings

Holdings is the primary tracking domain. It lets you record and monitor your
investment positions across asset types.

### 4.1 The Holdings List

Go to **Holdings → List**. The table shows all your holdings with these columns:
Type, Asset, Management (the broker or bank), Quantity / Weight, Price / Value, and
Purchase Date.

Use the search box above the table to filter by any of those fields.

### 4.2 Adding a Holding

Click **Add holding** (top right of the panel). A dialog opens. Select the asset
type first — the available fields change depending on the type (see below). Fill in
the fields and save.

### 4.3 Asset Types and Their Fields

| Field            |      ETF      |     Share     | Precious Metal |    Crypto    | Deposit Money |
| ---------------- | :-----------: | :-----------: | :------------: | :----------: | :-----------: |
| ISIN             | ✓ (validated) | ✓ (validated) |       —        |      —       |       —       |
| Name             |       ✓       |       ✓       |       ✓        |      ✓       |       ✓       |
| Management       |       ✓       |       ✓       |       ✓        |      ✓       |       ✓       |
| Quantity         |       ✓       |       ✓       |       —        |      ✓       |       —       |
| Weight (grams)   |       —       |       —       |       ✓        |      —       |       —       |
| Ø Purchase price |       ✓       |       ✓       |       —        |      ✓       |       —       |
| Current value    |       —       |       —       |       ✓        |      —       |       ✓       |
| Purchase date    |       —       | ✓ (optional)  |       —        | ✓ (optional) |       —       |

ISIN validation checks the checksum automatically — you will see an error immediately
if the ISIN is malformed.

**Management** is the broker, bank, or exchange where you hold the position (e.g.
"Trade Republic", "DKB", "Coinbase"). It is free text and used for filtering and
grouping.

### 4.4 Distribution Charts

Above the holdings table, a grid of pie charts shows how your portfolio is distributed
by value. The first chart covers all asset types combined. Additional charts break down
each type individually (up to five extra tiles).

Charts only appear once at least one holding with a known value has been added.

### 4.5 Editing and Deleting Holdings

Each row has two icon buttons on the right:

- **Pencil** — opens the edit dialog pre-filled with the holding's current values.
- **Trash** — opens a confirmation dialog before permanently deleting the holding.

Deletion cannot be undone.

### 4.6 Exporting Holdings Data

The **Export data** link (top right of the Holdings panel, next to **Add holding**) opens a dialog
with one card per format. Each card shows a preview, the exact file name, what the file contains and
what it suits best; its own button downloads that format, and the dialog stays open so you can
export several formats in one visit. The four formats:

| Format | Use case                                      |
| ------ | --------------------------------------------- |
| PDF    | Printable report with an embedded pie chart   |
| Excel  | Formatted `.xlsx` file with typed columns     |
| CSV    | Spreadsheet import (Excel, LibreOffice, etc.) |
| JSON   | Raw structured data for scripts or backups    |

Click a card's button to download that format; the file downloads immediately. An empty holdings list produces a valid but row-free file (CSV/JSON/Excel) or a
header-only PDF.

---

## 5. Account Overview

**Account Overview** is a reference directory of your financial accounts — bank
accounts, credit cards, brokerages, etc.

Each entry records: name, category, status (Active / Decommissioned), provider,
website, purpose, whether you use a card with it, required minimum balance, card
number (masked by default, click to reveal), card expiry date, and notes.

Categories: General, Leisure, Savings, Depot, Credit Card, Other.

Use the **Add account** button to create an entry. Edit and delete work the same as
in Holdings. Decommissioning an account marks it as inactive without deleting it —
useful for keeping historical records.

The **Export data** link (top right) works the same as in Holdings — JSON, CSV,
Excel, and PDF formats are available in the export dialog.

---

## 6. Klaro

**Klaro** is a companion habit-tracking application, developed separately from
Vaultfolio. The Klaro entry in the sidebar (shown with Klaro's own logo) opens an
information page — it does not embed Klaro itself.

The page explains what Klaro does and links out to the standalone app at
[klaro.allwang.family](https://klaro.allwang.family/), which opens in a new tab.
Klaro currently requires its own separate account; a future update will let you
synchronize data between the two apps as long as you use the identical email address
in both.

---

## 7. Earnings

**Earnings** turns your payslips into a career-long view of gross pay, net pay, taxes
and social insurance. It is available only if an administrator has enabled the
Earnings domain for your account (administrators always have it).

### 7.1 Access and Privacy

Payslips contain some of your most sensitive data, so Earnings works differently from
other domains:

- **Documents stay on your device.** PDFs are read in your browser. The file and its
  text are never uploaded — only the figures shown in the import preview are sent.
- **Only figures, no identifiers.** No tax ID, social-security number, IBAN, name or
  address is sent or stored.
- **Amounts are stored encrypted.** The operator of your Vaultfolio instance runs the
  server and holds the encryption key.
- **Only you can see it.** Nobody else in Vaultfolio — administrators included — can
  see your earnings.
- **One optional exception.** If a document is not recognized you may _request a parser_
  (see [7.6](#76-requesting-a-parser)): only after you review and consent, an anonymized,
  rebuilt copy — never the file and never your real figures — is sent to the administrators.

The link **How your data is protected** in the toolbar opens this note at any time.
If the page says _Earnings data is temporarily unavailable_, the server cannot decrypt
your figures right now; your data is not lost — contact the operator.

### 7.2 Importing Documents

Click **Import documents** and drop files onto the page (or use **Choose files**).
Supported are:

- **SAP payslips** ("Entgeltnachweis"), including corrections for earlier months,
- **Deutsche Bundesbank payslips** ("Verdienstabrechnung"), including corrections,
- **Bundeswehr pay statements** ("Wehrsoldabrechnung"), including corrections for earlier months,
- **wage-tax certificates** ("Lohnsteuerbescheinigung") from any employer,
- **export files** (`earnings-export`, version 1).

Every file gets a row with its outcome: **New**, **Replaces** (a newer version of
figures you already imported), **Duplicate** (already imported — skipped) or
**Rejected** with the reason, for example when gross − taxes − social insurance does
not add up to net, or when a PDF contains no automatically readable text and you decline to
have it read (see below). Rejected files are never saved.

**Scans and PDFs without text.** If a PDF contains no text that can be read automatically (a scan,
or a PDF whose text was converted to graphics), its row shows **Needs your decision**. Choose
**Read text on this device** to run text recognition: the file and its text stay in your browser,
it works offline, nothing is uploaded, stored or cached, and nothing starts before you agree (per
file). A progress bar shows the page being read and you can cancel at any time. Limits: German
documents only, up to 5 pages. The recognised text goes through the same readers and the same
arithmetic checks as any other PDF, but **digits can be misread** (a lost decimal comma, for
example): files read this way carry a **Text recognition** tag and a notice to double-check every
figure, a failing check opens the correction grid as usual, and the tag stays visible in the
imports list. If you choose **Not now**, cancel, nothing is recognised, or recognition cannot run,
the file is rejected as before and you can still choose **Read text on this device instead**.

If a payslip is rejected because a check does not add up, its figures open in the row
so you can fix a misread one: the figures taking part in the failing check are
highlighted (**In failing check**) and editable — both `1.234,56` and `1234.56` work.
The checks re-run with every edit; once they pass, the row shows **Corrected by you**
and can be imported. **Restore read value** puts the original back. Other figures cannot
be edited, the server checks everything again on import, and corrected figures stay
marked in the preview, the import history ("1 figure corrected by you") and the month
detail. Expand **Figures that will be sent** on a row to see exactly what leaves your
device. Nothing is saved until you click the import button at the bottom.

### 7.3 Overview, Tables and Month Detail

- **Overview** — a career summary (whole career and per employer, with averages per
  month employed), the latest year compared with the same months of the previous
  year, gross per year, where the gross goes month by month (net, taxes, social
  insurance), and deductions as a share of gross. Click a month in the chart to open
  its **month detail** with every payslip section of that month.
- **Tables** — a month grid per year (click a cell for the month detail), all taxes
  and contributions per year, and your wage-tax certificates.
- The **Employer** filter at the top narrows every view to one employer.
- **Export data** opens a dialog that offers your earnings as JSON, CSV (a ZIP with four CSV
  files), Excel or PDF. The PDF is a landscape
  summary: the gross-per-year chart, totals per employer with a closing "Career total"
  row, the monthly overview and all taxes and contributions per year (newest first,
  always for your whole career). Excel, CSV and JSON carry the same four tables as the
  PDF (gross per year, employers with the career total, monthly overview with gross and
  net in separate columns, taxes and contributions per year): Excel has one sheet per
  table, CSV is a ZIP with one file per table, and JSON uses the same field names in
  every language. They no longer list individual payslip parts. Earnings are also part
  of the full **Export my data** archive in your profile.

The dashboard shows an Earnings widget with the current year's gross, net and net
ratio.

### 7.4 Data Check

The **Data check** tab compares, per employer and year, the sum of your payslips with
the year-to-date totals printed on the last payslip of the year and with the wage-tax
certificate, and lists missing months. The number on the tab (and the strip on the
Overview) shows how many issues were found; each comes with a hint, such as which
payslips to import.

### 7.5 Imports, Renaming and Deleting

The **Imports** tab lists every imported file with its periods, number of records and
the parser (with version) that read it. The history is grouped by the year the data
belongs to; all years start collapsed — click a year to open it, or use **Expand all**.

- **Rename an employer** — give an employer a display name of your choice; the name
  detected from the documents is kept.
- **Delete an import** — removes exactly the figures that file added.
- **Delete all earnings data** — permanently removes all figures, certificates,
  employer names and the import history. Your other Vaultfolio data is not affected.

### 7.6 Requesting a Parser

If a PDF with text is rejected as **format not supported yet**, its row offers
**Request a parser** (not for password-protected files or files that failed a check; a scan
only after its text was read by text recognition, without a second consent). A four-step wizard guides you:

1. **Consent** — what stays on your device (the PDF, its text, all real figures), what is
   sent (only a rebuilt copy) and who sees it: the administrators of your instance, in
   the portal only (never by e-mail), deleted 30 days after the request is closed. The
   document check lists personal data found (bank account, tax ID, social-security
   number, e-mail, phone, postcode and city — removed automatically, no redaction needed)
   and text hidden under black boxes. Tick the consent box to continue.
2. **Review words** — the rebuilt page. Numbers are replaced by random values of the same
   shape; known labels stay; personal data is removed and locked. Decide for every other
   word whether to **keep it as a label** or **mask** it (click a word or use the list).
3. **Mark rules** _(optional)_ — mark which lines are which figure (gross, wage tax, …),
   the number column and format, and the period. A live check reads your original
   amounts on your device and tells you whether gross − taxes − social insurance = net
   adds up; it is never sent. The markings are a hint for the developer and are never
   executed. **Skip markings** drops them.
4. **Preview & send** — exactly what the administrators will receive. **Send request** is
   enabled once every word is decided and nothing personal remains; **Discard** throws
   everything away.

Only one request leaves your device: a structured, anonymized description of the layout —
never a file. The server checks it again and writes the sample PDF itself. You can have
three open requests and send five per day. When an administrator sets your request to
_Done_ you receive an e-mail with a link back to the import page. If you delete your
account, your requests and samples are deleted with it.

---

## 7a. Retirement

**Retirement** (_Altersvorsorge_) brings your statutory, occupational and private provision
together in one overview. It is available only if an administrator has enabled the Retirement
domain for your account.

### 7a.1 Entering Your Data

- **Upload a document.** Choose **Upload document** and select the PDF of your DRV pension
  statement (_Renteninformation_), a statement of an occupational or private pension, or a
  capital-account statement. The type is detected automatically. The PDF is read in your browser;
  the file and its text never leave your device — after you review the recognised values, only
  those figures are saved. Scanned documents need on-device text recognition, which asks for your
  consent per file. If a document is not recognised, nothing is saved and you can enter the values
  manually instead.
- **Enter manually.** Choose **Enter manually**, pick the type (statutory pension, occupational
  pension, Riester, private pension insurance or Altersvorsorgedepot) and fill in the fields that
  apply to it. A guaranteed pension above the expected pension is rejected.
- **Imported entries are read-only.** Values taken from a document cannot be edited; you can add
  what the document does not print (for example the monthly contribution) and replace the entry
  with a newer document. Manual entries can be edited at any time.

Guaranteed amounts are shown in bold with a "guaranteed" tag; expected amounts are projections
and are shown in italics with a "≈" prefix.

### 7a.2 Overview and Tabs

The **Overview** tab shows the expected and guaranteed monthly pension, your current monthly
savings, the pension start, a guaranteed-vs-expected bar and a card per pillar. Entries older than
12 months are flagged **Outdated**; entries missing figures needed for the totals are flagged
**Incomplete**. Capital payouts and capital accounts are not part of the monthly pension, and all
amounts are gross. The **Statutory**, **Occupational** and **Private** tabs list the contracts of a
pillar; **Further information** links to external resources (links send no data).

The Dashboard shows a Retirement tile with the key figures; clicking it opens the area.

### 7a.3 Privacy, Export and Deleting

Amounts and contract numbers are stored encrypted; your name, address, tax ID and bank details are
never requested or stored. The operator of your instance holds the encryption key. If the page says
_Retirement is unavailable_, the server cannot read the data right now — it is not lost; contact
the operator. **Export** (toolbar) writes your entries as PDF, Excel, CSV or JSON. At the bottom of
**Further information** you can delete all your retirement data (the account stays); single
entries can be deleted on their card.

---

## 7b. Wealth

**Wealth** (_Vermögensentwicklung_) shows how your net worth develops over time, from snapshots you
record by hand. It is available only if an administrator has enabled the Wealth domain for your
account. Nothing is imported from banks, brokers or Holdings.

### 7b.1 Recording Snapshots

- A **snapshot** (_Stichtag_) is a reference date with any number of entries. Each entry has a
  name, a class and an amount; the panel decides whether it is an **asset** or a **liability** —
  amounts are always entered as positive numbers (`12.000,50` and `12000.50` both work).
- The class is free text. Suggestions (cash, bank balances, precious metals, shares & funds, crypto,
  real estate, vehicles, collectibles; mortgage, loan, other debt) are offered, and classes you
  typed before are suggested again. When you type a **new** class, you are asked once which balance
  group it belongs to.
- **Copy from existing snapshot** prefills names and classes, so you can bring earlier reference
  dates over quickly; remove entries that did not exist back then. The **Also copy amounts**
  checkbox next to it (on by default) takes over the old amounts too, so you can compare while you
  type; untick it to start with blank amounts. Snapshots may be recorded in any order — everything
  is sorted by date. The same action is available on each table row (_Copy as template_).
- Drag the handle at the left of an entry to reorder the entries within the assets or the
  liabilities panel; with the handle focused, the up and down arrow keys move it too.
- There is one snapshot per date. If the date is taken you are offered to open the existing one.
  Snapshots can be edited and deleted at any time.

### 7b.2 Development, Balance Sheet and Tile

The **Development** tab shows net worth, change since the previous snapshot (absolute and percent;
_n/a_ when the previous net worth was not positive; green for an increase, red for a decrease, grey
for no change), assets and liabilities, a chart with one
column per snapshot (assets stacked by class above the zero line, liabilities hatched below it, net
worth as a line; click the legend to hide a class) and the snapshot table, newest first. Besides
the change in € and %, the table shows the change **p.a.**: the percent change since the previous
snapshot extrapolated to a year based on the days between the two dates (_n/a_ unless both net
worths are positive). Over short intervals this figure swings widely. The
**period** filter (1 year, 3 years, all) applies to the chart, the table, the changes and the PDF.
With one snapshot you see the composition and a hint to add a second; without snapshots, an
invitation to record the first.

The **Balance sheet** tab groups the entries of a chosen snapshot into _Aktiva_ and _Passiva_ with
sub-totals; equity is the net worth, so both sides always add up to the same total. Use the class
selector to move a class to another balance group — the change applies to all snapshots. No ratios
are calculated.

The Dashboard shows a Wealth tile with the latest net worth, the change and a small trend; it can be
hidden and reordered like every tile, and clicking it opens the area.

### 7b.3 Export, Privacy and Deleting

**Export data** writes a PDF report (key figures, chart, latest snapshot by class, all snapshots and
the balance sheet; it follows the period filter) or all entries and totals as Excel, CSV or JSON.
Entry names, classes, amounts and notes are stored encrypted and are never written to logs. At the
bottom of the page **Delete all wealth data** removes every snapshot and setting (the account stays);
single snapshots are deleted from their table row. If the page says _Wealth data is temporarily
unavailable_, the server cannot read the data right now — it is not lost; contact the operator.

---

## 8. Settings

### 8.1 Profile

**Display name** — Change how your name appears across the app. Updates immediately
without a page reload.

**Email address** — Request a change. A verification link is sent to the _new_
address. Your current address stays active until the new one is confirmed (link valid
24 hours).

**Password** — Requires your current password. Changing it signs out all other active
sessions; your current session stays signed in.

**Export my data** — Downloads a ZIP archive containing your data from all domains
in all supported formats (JSON, CSV, Excel, PDF). Use this before deleting your
account or for an offline backup.

**Danger Zone — Delete account** — Permanently deletes your account and all owned
data. The flow has three steps: an advisory screen, an option to export data first,
and finally typing `DELETE` to confirm. This action cannot be undone.

> If you are the only administrator, account deletion is blocked. Promote another
> user to admin first.

### 8.2 Preferences

**Email language** — Sets the language used in emails sent to you (verification
links, notifications). This is independent of the UI display language, which is set
in the header.

---

## 9. Admin Area

The Admin area is only visible to users with the Administrator role.

### 9.1 Managing Accounts

The **Accounts** tab lists all accounts (active and archived).

**Roles:**

- **Member** — standard access, limited to domains they have been granted.
- **Admin** — full access to all domains and the admin area.

Change a user's role with the role selector in their row. Admins automatically have
access to all domains; the domain toggles are disabled for admin accounts.

**Domain access** — Toggle each domain per member to control which areas they can
navigate to. Changes take effect on the user's next page load.

**Archiving** — Archived accounts cannot sign in. An archived account can be
reactivated within 30 days; after that it is permanently deleted. You cannot archive
or demote the last remaining administrator.

### 9.2 Invitations

The **Invitations** tab shows all invitations and their status:

| Status     | Meaning                                         |
| ---------- | ----------------------------------------------- |
| Pending    | Sent, not yet accepted                          |
| Accepted   | User has set their password and is active       |
| Expired    | Link was not used in time                       |
| Cancelled  | Manually cancelled by an admin                  |
| Superseded | A newer invitation was sent to the same address |

Click **Invite member** to send a new invitation (email address and role). The
invited user sets their own password — you never see it.

Per-row actions: **Resend** (generates a new link, superseding the old one) and
**Cancel** (with confirmation).

### 9.3 Sign-Up Requests

The **Sign-ups** tab shows self-service registration requests. Each request moves
through these stages:

1. **Awaiting verification** — user has registered but not clicked the email link yet.
2. **Awaiting review** — email verified, waiting for admin decision.
3. **Approved** or **Rejected** — terminal states.

Per-row actions:

- **Approve** — creates an active account and emails the user.
- **Reject** — you may add an internal reason note (the user is not told the reason).
- **Delete** — removes the entry and unblocks the email address so the person can
  sign up again.

### 9.4 Parser and Other Requests

**Admin → Requests** lists requests sent by users, newest first, with a status filter and
the number of open requests on the tab. Open a row (or the link in the notification
e-mail, which needs a sign-in) to see who sent it and when, and — for a parser request —
the **anonymized sample** (download as PDF; every download is logged), the **rule hints**
the requester marked (shown as a hint only, never executed) and a **possible duplicate**
note when another open request has the same layout.

Set the **status** (Open, In progress, Done, Rejected) and an internal **note**. Setting
_Done_ e-mails the requester. The sample and rule hints are deleted automatically 30 days
after a request is Done or Rejected (reopening cancels this); the request and its status
stay. Nobody but administrators can see requests, not even the person who sent them.

### 9.5 System Health

**Admin → General** shows the current system status: backend health (ok / degraded)
and database connectivity (connected / unreachable), with a "last checked" timestamp.
Use this if the app is behaving unexpectedly to confirm the backend is reachable.
