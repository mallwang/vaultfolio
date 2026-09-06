import { Account } from '@vaultfolio/domain-accounts';
import type { AccountCategory, ValidatedAccount } from '@vaultfolio/domain-accounts';
import type {
  AccountOverviewEntry,
  CreateAccountOverviewEntryRequest,
  UpdateAccountOverviewEntryRequest,
} from '@vaultfolio/api-contract';

/** The raw submission shape `account-validation.ts`'s `validateAccountSubmission` accepts. */
export interface AccountSubmissionInput {
  name: string;
  category?: AccountCategory;
  provider?: string | null;
  website?: string | null;
  purpose?: string | null;
  cardUsage?: string | null;
  requiredMinimum?: string | null;
  notes?: string | null;
}

/** Raw `better-sqlite3` row shape for the `accounts` table (snake_case columns). */
export interface AccountRow {
  id: string;
  name: string;
  category: AccountCategory;
  provider: string | null;
  website: string | null;
  purpose: string | null;
  card_usage: string | null;
  required_minimum: string | null;
  notes: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

/** SQLite's `TEXT` timestamp columns come back as ISO-8601 strings, not `Date` (mirrors holdings.mapper.ts). */
function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

/** DB row -> domain `Account`. */
export function rowToAccount(row: AccountRow): Account {
  return new Account({
    id: row.id,
    name: row.name,
    category: row.category,
    provider: row.provider,
    website: row.website,
    purpose: row.purpose,
    cardUsage: row.card_usage,
    requiredMinimum: row.required_minimum,
    notes: row.notes,
    ownerId: null,
    createdAt: toDate(row.created_at),
    updatedAt: toDate(row.updated_at),
  });
}

/** domain `Account` -> API `AccountOverviewEntry` (never includes `ownerId`, mirroring `holdingToResponse`). */
export function accountToResponse(account: Account): AccountOverviewEntry {
  return {
    id: account.id,
    name: account.name,
    category: account.category,
    provider: account.provider,
    website: account.website,
    purpose: account.purpose,
    cardUsage: account.cardUsage,
    requiredMinimum: account.requiredMinimum,
    notes: account.notes,
    createdAt: account.createdAt.toISOString(),
    updatedAt: account.updatedAt.toISOString(),
  };
}

/** POST /account-overview/accounts body -> domain validation's raw submission shape. */
export function createRequestToSubmission(
  body: CreateAccountOverviewEntryRequest,
): AccountSubmissionInput {
  return {
    name: typeof body.name === 'string' ? body.name : '',
    category: body.category,
    provider: body.provider,
    website: body.website,
    purpose: body.purpose,
    cardUsage: body.cardUsage,
    requiredMinimum: body.requiredMinimum,
    notes: body.notes,
  };
}

/**
 * PUT /account-overview/accounts/:id body -> domain validation's raw
 * submission shape, merged onto the existing account (contracts/
 * account-overview-api.md: a field omitted from the body leaves the current
 * stored value unchanged; a field present — including an empty string —
 * replaces it, which validation then trims/null-normalizes as usual).
 */
export function updateRequestToSubmission(
  existing: Account,
  body: UpdateAccountOverviewEntryRequest,
): AccountSubmissionInput {
  return {
    name: body.name !== undefined ? body.name : existing.name,
    category: body.category !== undefined ? body.category : existing.category,
    provider: body.provider !== undefined ? body.provider : existing.provider,
    website: body.website !== undefined ? body.website : existing.website,
    purpose: body.purpose !== undefined ? body.purpose : existing.purpose,
    cardUsage: body.cardUsage !== undefined ? body.cardUsage : existing.cardUsage,
    requiredMinimum:
      body.requiredMinimum !== undefined ? body.requiredMinimum : existing.requiredMinimum,
    notes: body.notes !== undefined ? body.notes : existing.notes,
  };
}

/** Validated submission -> the field set the repository persists (snake_case columns). */
export function validatedAccountToRow(value: ValidatedAccount): {
  name: string;
  category: AccountCategory;
  provider: string | null;
  website: string | null;
  purpose: string | null;
  card_usage: string | null;
  required_minimum: string | null;
  notes: string | null;
} {
  return {
    name: value.name,
    category: value.category,
    provider: value.provider,
    website: value.website,
    purpose: value.purpose,
    card_usage: value.cardUsage,
    required_minimum: value.requiredMinimum,
    notes: value.notes,
  };
}
