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
8. [Settings](#8-settings)
   - 8.1 [Profile](#81-profile)
   - 8.2 [Preferences](#82-preferences)
9. [Admin Area](#9-admin-area)
   - 9.1 [Managing Accounts](#91-managing-accounts)
   - 9.2 [Invitations](#92-invitations)
   - 9.3 [Sign-Up Requests](#93-sign-up-requests)
   - 9.4 [System Health](#94-system-health)

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

The **Export** split-button (top right of the Holdings panel, next to **Add holding**) lets you
download your holdings in four formats:

| Format | Use case                                      |
| ------ | --------------------------------------------- |
| PDF    | Printable report with an embedded pie chart   |
| Excel  | Formatted `.xlsx` file with typed columns     |
| CSV    | Spreadsheet import (Excel, LibreOffice, etc.) |
| JSON   | Raw structured data for scripts or backups    |

Click the button label to open the format menu, then select your format. The file downloads
immediately. An empty holdings list produces a valid but row-free file (CSV/JSON/Excel) or a
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

The **Export** split-button (top right) works the same as in Holdings — JSON, CSV,
Excel, and PDF formats are available.

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

The link **How your data is protected** in the toolbar opens this note at any time.
If the page says _Earnings data is temporarily unavailable_, the server cannot decrypt
your figures right now; your data is not lost — contact the operator.

### 7.2 Importing Documents

Click **Import documents** and drop files onto the page (or use **Choose files**).
Supported are:

- **SAP payslips** ("Entgeltnachweis"), including corrections for earlier months,
- **wage-tax certificates** ("Lohnsteuerbescheinigung") from any employer,
- **companion-tool export files** (`earnings-export`, version 1) — the way to bring in
  other payslip layouts and scans.

Every file gets a row with its outcome: **New**, **Replaces** (a newer version of
figures you already imported), **Duplicate** (already imported — skipped) or
**Rejected** with the reason, for example when gross − taxes − social insurance does
not add up to net, or when a PDF is a scan without text. Rejected files are never
saved. Expand **Figures that will be sent** on a row to see exactly what leaves your
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
- **Export** offers your earnings as JSON, CSV, Excel or PDF. Earnings are also part of
  the full **Export my data** archive in your profile.

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
the parser (with version) that read it.

- **Rename an employer** — give an employer a display name of your choice; the name
  detected from the documents is kept.
- **Delete an import** — removes exactly the figures that file added.
- **Delete all earnings data** — permanently removes all figures, certificates,
  employer names and the import history. Your other Vaultfolio data is not affected.

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

### 9.4 System Health

**Admin → General** shows the current system status: backend health (ok / degraded)
and database connectivity (connected / unreachable), with a "last checked" timestamp.
Use this if the app is behaving unexpectedly to confirm the backend is reachable.
