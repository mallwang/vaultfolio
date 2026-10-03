import { Injectable, Logger } from '@nestjs/common';
import type {
  RetirementPillar,
  RetirementRecord,
  RetirementSummary,
  RetirementSupplement,
} from '@vaultfolio/api-contract';
import {
  PILLARS,
  failedChecks,
  runChecks,
  summarize,
  validateRecordInput,
  validateSupplementPatch,
} from '@vaultfolio/retirement';
import {
  RetirementCheckFailedException,
  RetirementImportedReadonlyException,
  RetirementNotImportedException,
  RetirementRecordNotFoundException,
  RetirementStatutoryExistsException,
  RetirementValidationException,
} from './retirement.exceptions';
import { RetirementRepository } from './retirement.repository';

/** Keys a `PUT` body must not carry: origin and import information are fixed at creation. */
const PUT_FORBIDDEN_KEYS = ['origin', 'import', 'replaces', 'supplement'] as const;

/** Validates the optional `?pillar=` query value. */
export function pillarParam(value: unknown): RetirementPillar | undefined {
  if (value === undefined || value === '') return undefined;
  if (typeof value !== 'string' || !(PILLARS as readonly string[]).includes(value)) {
    throw new RetirementValidationException([{ field: 'pillar', code: 'INVALID_VALUE' }]);
  }
  return value as RetirementPillar;
}

/**
 * Retirement use cases (contracts/retirement-api.md). Bodies are validated by the strict whitelist
 * of `@vaultfolio/retirement`; imported records additionally pass the plausibility checks again
 * from their figures. Every call is scoped to `ownerId`; a foreign id behaves like a missing id.
 * Logs carry ids, pillar, type, parser id/version and the outcome — never figures or identifiers.
 */
@Injectable()
export class RetirementService {
  private readonly logger = new Logger(RetirementService.name);

  constructor(private readonly repository: RetirementRepository) {}

  list(ownerId: string, pillar?: RetirementPillar): RetirementRecord[] {
    return this.repository.list(ownerId, pillar);
  }

  /** Consolidated overview of the owner's records (research R8); empty owner → zeros. */
  summary(ownerId: string): RetirementSummary {
    return summarize(this.repository.list(ownerId), new Date());
  }

  get(ownerId: string, id: string): RetirementRecord {
    const record = this.repository.get(ownerId, id);
    if (!record) throw new RetirementRecordNotFoundException();
    return record;
  }

  create(ownerId: string, body: unknown): RetirementRecord {
    const input = this.validate(body);
    if (input.origin === 'IMPORTED') {
      const failed = failedChecks(
        runChecks(input.contractType, input.figures, {
          statementDate: input.statementDate,
          payoutStart: input.payoutStart,
        }),
      );
      if (failed.length > 0) {
        this.logger.warn({
          event: 'RetirementImportRejected',
          contractType: input.contractType,
          parserId: input.import?.parserId,
          parserVersion: input.import?.parserVersion,
          failedChecks: failed,
        });
        throw new RetirementCheckFailedException(failed);
      }
    }

    const { replaces, ...data } = input;
    let record: RetirementRecord | null;
    if (replaces !== undefined) {
      record = this.repository.replace(ownerId, replaces, data);
      if (!record) throw new RetirementRecordNotFoundException();
    } else {
      if (data.contractType === 'STATUTORY_PENSION' && this.repository.hasStatutory(ownerId)) {
        throw new RetirementStatutoryExistsException();
      }
      record = this.repository.insert(ownerId, data);
    }
    this.logger.log({
      event: replaces === undefined ? 'RetirementRecordCreated' : 'RetirementRecordReplaced',
      id: record.id,
      pillar: record.pillar,
      contractType: record.contractType,
      origin: record.origin,
      parserId: record.import?.parserId,
      parserVersion: record.import?.parserVersion,
      replaced: replaces,
    });
    return record;
  }

  update(ownerId: string, id: string, body: unknown): RetirementRecord {
    const existing = this.get(ownerId, id);
    if (existing.origin === 'IMPORTED') throw new RetirementImportedReadonlyException();

    const forbidden = isObject(body)
      ? PUT_FORBIDDEN_KEYS.filter((key) => key in body).map((field) => ({
          field,
          code: 'UNKNOWN_FIELD' as const,
        }))
      : [];
    if (forbidden.length > 0) throw new RetirementValidationException(forbidden);

    const input = this.validate({ ...(body as object), origin: 'MANUAL' });
    if (input.contractType !== existing.contractType) {
      throw new RetirementValidationException([{ field: 'contractType', code: 'INVALID_VALUE' }]);
    }
    const record = this.repository.update(ownerId, id, input);
    if (!record) throw new RetirementRecordNotFoundException();
    this.logger.log({
      event: 'RetirementRecordUpdated',
      id,
      pillar: record.pillar,
      contractType: record.contractType,
    });
    return record;
  }

  updateSupplement(ownerId: string, id: string, body: unknown): RetirementRecord {
    const existing = this.get(ownerId, id);
    if (existing.origin !== 'IMPORTED') throw new RetirementNotImportedException();

    const result = validateSupplementPatch(existing.contractType, body);
    if (!result.ok) throw new RetirementValidationException(result.issues);
    const { status, ...fields } = result.value;
    const supplement: RetirementSupplement = { ...existing.supplement, ...fields };
    const record = this.repository.updateSupplement(ownerId, id, supplement, status);
    if (!record) throw new RetirementRecordNotFoundException();
    this.logger.log({
      event: 'RetirementSupplementUpdated',
      id,
      pillar: record.pillar,
      contractType: record.contractType,
    });
    return record;
  }

  delete(ownerId: string, id: string): void {
    if (!this.repository.delete(ownerId, id)) throw new RetirementRecordNotFoundException();
    this.logger.log({ event: 'RetirementRecordDeleted', id });
  }

  deleteAll(ownerId: string): void {
    const count = this.repository.deleteAll(ownerId);
    this.logger.log({ event: 'RetirementDeletedAll', count });
  }

  private validate(body: unknown) {
    const result = validateRecordInput(body, { now: new Date() });
    if (!result.ok) throw new RetirementValidationException(result.issues);
    return result.value;
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
