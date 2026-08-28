import { Injectable, Logger } from '@nestjs/common';
import type { Holding } from '@vaultfolio/domain-holdings';
import { decideMerge, validateHoldingSubmission } from '@vaultfolio/domain-holdings';
import type { FieldError } from '@vaultfolio/domain-holdings';
import type { CreateHoldingRequest, UpdateHoldingRequest } from '@vaultfolio/api-contract';
import { HoldingsRepository } from './holdings.repository';
import { createRequestToSubmission, updateRequestToSubmission } from './holdings.mapper';

export type CreateHoldingResult =
  | { kind: 'created' | 'updated'; holding: Holding }
  | { kind: 'invalid'; fieldErrors: FieldError[] };

export type UpdateHoldingResult =
  | { kind: 'updated'; holding: Holding }
  | { kind: 'invalid'; fieldErrors: FieldError[] }
  | { kind: 'not_found' };

/**
 * Orchestrates domain validation (`domain-holdings`'s `validateHoldingSubmission`)
 * + the merge decision (`decideMerge`) + persistence (`HoldingsRepository`).
 * Structured logging on every create/update/delete (id, asset type,
 * management, outcome) per Principle V, so a stored value's origin is
 * traceable.
 */
@Injectable()
export class HoldingsService {
  private readonly logger = new Logger(HoldingsService.name);

  constructor(private readonly repository: HoldingsRepository) {}

  async findAll(): Promise<Holding[]> {
    return this.repository.findAll();
  }

  /**
   * FR-001–FR-011a: creates a new holding, or — for ETF/Gold whose
   * `(identifier, management)` matches an existing row — replaces that row
   * in place instead.
   */
  async create(body: CreateHoldingRequest): Promise<CreateHoldingResult> {
    const submission = createRequestToSubmission(body);
    const validation = validateHoldingSubmission(submission);
    if (!validation.valid) {
      return { kind: 'invalid', fieldErrors: validation.fieldErrors };
    }
    const value = validation.value;

    let candidate: Holding | null = null;
    if (value.assetType === 'ETF' || value.assetType === 'GOLD') {
      candidate = await this.repository.findUpsertMatch(
        value.assetType,
        value.management,
        value.assetType === 'ETF' ? value.isin : null,
      );
    }

    const decision = decideMerge(value, candidate ? [candidate] : []);

    if (decision.kind === 'update') {
      const holding = await this.repository.updateById(decision.existingId, value);
      // decision.existingId came from a row this same call just looked up —
      // it cannot have vanished between the lookup and this update.
      this.logNonNull(holding, 'updated');
      return { kind: 'updated', holding: holding as Holding };
    }

    const holding = await this.repository.insert(value);
    this.log(holding, 'created');
    return { kind: 'created', holding };
  }

  /** FR-014: edits an existing holding's fields in place. `assetType` is immutable — never accepted here. */
  async update(id: string, body: UpdateHoldingRequest): Promise<UpdateHoldingResult> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      return { kind: 'not_found' };
    }

    const submission = updateRequestToSubmission(existing.assetType, body);
    const validation = validateHoldingSubmission(submission);
    if (!validation.valid) {
      return { kind: 'invalid', fieldErrors: validation.fieldErrors };
    }

    const holding = await this.repository.updateById(id, validation.value);
    this.logNonNull(holding, 'updated');
    return { kind: 'updated', holding: holding as Holding };
  }

  /** FR-016: hard delete. Returns whether a row existed to delete (404 vs 204 for the controller). */
  async delete(id: string): Promise<boolean> {
    // Fetched before deleting so the log line can carry asset type/management
    // even for the deleted row (Principle V — "a stored value's origin is
    // traceable", which includes when/why it stopped being stored).
    const existing = await this.repository.findById(id);
    const deleted = await this.repository.deleteById(id);
    this.logger.log({
      id,
      assetType: existing?.assetType ?? null,
      management: existing?.management ?? null,
      outcome: deleted ? 'deleted' : 'not_found',
    });
    return deleted;
  }

  private log(holding: Holding, outcome: 'created' | 'updated' | 'deleted'): void {
    this.logger.log({
      id: holding.id,
      assetType: holding.assetType,
      management: holding.management,
      outcome,
    });
  }

  private logNonNull(holding: Holding | null, outcome: 'created' | 'updated'): void {
    if (holding) {
      this.log(holding, outcome);
    }
  }
}
