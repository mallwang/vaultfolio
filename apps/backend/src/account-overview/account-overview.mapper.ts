import { Account } from '@vaultfolio/domain-accounts';
import type { ValidatedAccount } from '@vaultfolio/domain-accounts';
import type { AccountCategory, AccountStatus } from '@vaultfolio/account-fields';
import type {
  AccountOverviewEntry,
  CreateAccountOverviewEntryRequest,
  UpdateAccountOverviewEntryRequest,
} from '@vaultfolio/api-contract';

/** The raw submission shape `account-validation.ts`'s `validateAccountSubmission` accepts. */
export interface AccountSubmissionInput {
  name: string;
  category?: AccountCategory;
  status?: AccountStatus;
  provider?: string | null;
  website?: string | null;
  purpose?: string | null;
  cardUsage?: string | null;
  requiredMinimum?: string | null;
  notes?: string | null;
  cardNumber?: string | null;
  validUntil?: string | null;
}

/** Raw `better-sqlite3` row shape for `account_overview_entries`; every field lives inside `payload_enc`. */
export interface AccountRow {
  id: string;
  owner_id: string;
  payload_enc: string;
  created_at: string;
  updated_at: string;
}

/** The encrypted JSON payload of one row: exactly the validated account fields. */
export type AccountPayload = ValidatedAccount;

/** Decrypted payload + row metadata -> domain `Account`. */
export function payloadToAccount(row: AccountRow, payload: AccountPayload): Account {
  return new Account({
    id: row.id,
    ...payload,
    ownerId: null,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  });
}

/** domain `Account` -> API `AccountOverviewEntry` (never includes `ownerId`, mirroring `holdingToResponse`). */
export function accountToResponse(account: Account): AccountOverviewEntry {
  return {
    id: account.id,
    name: account.name,
    category: account.category,
    status: account.status,
    provider: account.provider,
    website: account.website,
    purpose: account.purpose,
    cardUsage: account.cardUsage,
    requiredMinimum: account.requiredMinimum,
    notes: account.notes,
    cardNumber: account.cardNumber,
    validUntil: account.validUntil,
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
    status: body.status,
    provider: body.provider,
    website: body.website,
    purpose: body.purpose,
    cardUsage: body.cardUsage,
    requiredMinimum: body.requiredMinimum,
    notes: body.notes,
    cardNumber: body.cardNumber,
    validUntil: body.validUntil,
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
    name: body.name ?? existing.name,
    category: body.category ?? existing.category,
    status: body.status ?? existing.status,
    provider: body.provider ?? existing.provider,
    website: body.website ?? existing.website,
    purpose: body.purpose ?? existing.purpose,
    cardUsage: body.cardUsage ?? existing.cardUsage,
    requiredMinimum: body.requiredMinimum ?? existing.requiredMinimum,
    notes: body.notes ?? existing.notes,
    cardNumber: body.cardNumber ?? existing.cardNumber,
    validUntil: body.validUntil ?? existing.validUntil,
  };
}
