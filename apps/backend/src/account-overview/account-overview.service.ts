import { Injectable, Logger } from '@nestjs/common';
import type { Account } from '@vaultfolio/domain-accounts';
import { validateAccountSubmission } from '@vaultfolio/domain-accounts';
import type { FieldError } from '@vaultfolio/domain-accounts';
import type {
  CreateAccountOverviewEntryRequest,
  UpdateAccountOverviewEntryRequest,
} from '@vaultfolio/api-contract';
import { AccountOverviewRepository } from './account-overview.repository';
import { createRequestToSubmission, updateRequestToSubmission } from './account-overview.mapper';

export type CreateAccountResult =
  { kind: 'created'; account: Account } | { kind: 'invalid'; fieldErrors: FieldError[] };

export type UpdateAccountResult =
  | { kind: 'updated'; account: Account }
  | { kind: 'invalid'; fieldErrors: FieldError[] }
  | { kind: 'not_found' };

/**
 * Orchestrates domain validation (`domain-accounts`'s
 * `validateAccountSubmission`) + persistence (`AccountOverviewRepository`).
 * Structured logging on every create/update/delete, mirroring
 * `holdings.service.ts`.
 */
@Injectable()
export class AccountOverviewService {
  private readonly logger = new Logger(AccountOverviewService.name);

  constructor(private readonly repository: AccountOverviewRepository) {}

  async findAll(ownerId: string): Promise<Account[]> {
    return this.repository.findAllByOwner(ownerId);
  }

  /** FR-003/FR-006/FR-007: always inserts a new row — no upsert-matching (data-model.md's "State transitions"). */
  async create(
    body: CreateAccountOverviewEntryRequest,
    ownerId: string,
  ): Promise<CreateAccountResult> {
    const submission = createRequestToSubmission(body);
    const validation = validateAccountSubmission(submission);
    if (!validation.valid) {
      return { kind: 'invalid', fieldErrors: validation.fieldErrors };
    }

    const account = await this.repository.insert(validation.value, ownerId);
    this.log(account, 'created');
    return { kind: 'created', account };
  }

  /**
   * FR-004: edits an existing account's fields in place — a field omitted
   * from the body leaves its current value unchanged (mapper's merge). A
   * foreign-owned id is reported as `not_found`, the same as a nonexistent
   * one (no 403 vs 404 signal, matching `holdings`' precedent).
   */
  async update(
    id: string,
    body: UpdateAccountOverviewEntryRequest,
    ownerId: string,
  ): Promise<UpdateAccountResult> {
    const existing = await this.repository.findByIdForOwner(id, ownerId);
    if (!existing) {
      return { kind: 'not_found' };
    }

    const submission = updateRequestToSubmission(existing, body);
    const validation = validateAccountSubmission(submission);
    if (!validation.valid) {
      return { kind: 'invalid', fieldErrors: validation.fieldErrors };
    }

    const account = await this.repository.updateForOwner(id, ownerId, validation.value);
    this.logNonNull(account, 'updated');
    return { kind: 'updated', account: account as Account };
  }

  /** FR-005: hard delete. Returns whether a row existed to delete (404 vs 204 for the controller). */
  async delete(id: string, ownerId: string): Promise<boolean> {
    const existing = await this.repository.findByIdForOwner(id, ownerId);
    const deleted = await this.repository.deleteForOwner(id, ownerId);
    this.logger.log({
      id,
      name: existing?.name ?? null,
      outcome: deleted ? 'deleted' : 'not_found',
    });
    return deleted;
  }

  private log(account: Account, outcome: 'created' | 'updated'): void {
    this.logger.log({ id: account.id, name: account.name, category: account.category, outcome });
  }

  private logNonNull(account: Account | null, outcome: 'created' | 'updated'): void {
    if (account) {
      this.log(account, outcome);
    }
  }
}
