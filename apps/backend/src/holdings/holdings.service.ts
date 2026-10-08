import { Injectable, Logger } from '@nestjs/common';
import {
  decideMerge,
  validateHoldingSubmission,
  type Holding,
  type FieldError,
} from '@vaultfolio/domain-holdings';
import type { CreateHoldingRequest, UpdateHoldingRequest } from '@vaultfolio/api-contract';
import { HoldingsRepository } from './holdings.repository';
import { requestToSubmission } from './holdings.mapper';

export type CreateHoldingResult =
  | { kind: 'created' | 'updated'; holding: Holding }
  | { kind: 'invalid'; fieldErrors: FieldError[] };

export type UpdateHoldingResult =
  | { kind: 'updated'; holding: Holding }
  | { kind: 'invalid'; fieldErrors: FieldError[] }
  | { kind: 'not_found' };

/**
 * Domain validation + merge decision + persistence. Logs id, asset type and outcome only: the
 * management, names and amounts are encrypted at rest and stay out of the logs.
 */
@Injectable()
export class HoldingsService {
  private readonly logger = new Logger(HoldingsService.name);

  constructor(private readonly repository: HoldingsRepository) {}

  findAll(ownerId: string): Holding[] {
    return this.repository.findAll(ownerId);
  }

  /** Creates a holding, or replaces the existing one with the same merge key in place. */
  create(body: CreateHoldingRequest, ownerId: string): CreateHoldingResult {
    const validation = validateHoldingSubmission(requestToSubmission(body.assetType, body));
    if (!validation.valid) {
      return { kind: 'invalid', fieldErrors: validation.fieldErrors };
    }
    const value = validation.value;

    const decision = decideMerge(value, this.repository.findAll(ownerId));
    if (decision.kind === 'update') {
      const holding = this.repository.update(decision.existingId, value, ownerId) as Holding;
      this.log(holding, 'updated');
      return { kind: 'updated', holding };
    }

    const holding = this.repository.insert(value, ownerId);
    this.log(holding, 'created');
    return { kind: 'created', holding };
  }

  /**
   * Edits an existing holding in place. `assetType` is immutable: a body that carries a different
   * one is rejected. A foreign-owned id is `not_found`, same as a missing one.
   */
  update(id: string, body: UpdateHoldingRequest, ownerId: string): UpdateHoldingResult {
    const existing = this.repository.findById(id, ownerId);
    if (!existing) {
      return { kind: 'not_found' };
    }
    const sent = (body as { assetType?: unknown }).assetType;
    if (sent !== undefined && sent !== existing.assetType) {
      return { kind: 'invalid', fieldErrors: [{ field: 'assetType', code: 'FIELD_NOT_ALLOWED' }] };
    }

    const validation = validateHoldingSubmission(requestToSubmission(existing.assetType, body));
    if (!validation.valid) {
      return { kind: 'invalid', fieldErrors: validation.fieldErrors };
    }

    const holding = this.repository.update(id, validation.value, ownerId) as Holding;
    this.log(holding, 'updated');
    return { kind: 'updated', holding };
  }

  /** Hard delete; returns whether a row existed (404 vs 204 for the controller). */
  delete(id: string, ownerId: string): boolean {
    const deleted = this.repository.delete(id, ownerId);
    this.logger.log({ id, outcome: deleted ? 'deleted' : 'not_found' });
    return deleted;
  }

  private log(holding: Holding, outcome: 'created' | 'updated'): void {
    this.logger.log({ id: holding.id, assetType: holding.assetType, outcome });
  }
}
