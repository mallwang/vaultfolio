import { Injectable, Logger } from '@nestjs/common';
import type { WealthSettings, WealthSnapshot } from '@vaultfolio/api-contract';
import {
  MAX_SNAPSHOTS,
  classKey,
  validateClassGroup,
  validateSnapshotInput,
} from '@vaultfolio/wealth';
import {
  WealthLimitExceededException,
  WealthSnapshotNotFoundException,
  WealthValidationException,
} from './wealth.exceptions';
import { WealthRepository } from './wealth.repository';

/**
 * Wealth use cases (contracts/wealth-api.md). Bodies are validated by the strict whitelist of
 * `@vaultfolio/wealth`. Every call is scoped to `ownerId`; a foreign id behaves like a missing id.
 * Logs carry snapshot id, entry count and outcome — never names, classes or amounts.
 */
@Injectable()
export class WealthService {
  private readonly logger = new Logger(WealthService.name);

  constructor(private readonly repository: WealthRepository) {}

  list(ownerId: string): WealthSnapshot[] {
    return this.repository.list(ownerId);
  }

  get(ownerId: string, id: string): WealthSnapshot {
    const snapshot = this.repository.get(ownerId, id);
    if (!snapshot) throw new WealthSnapshotNotFoundException();
    return snapshot;
  }

  create(ownerId: string, body: unknown): WealthSnapshot {
    const input = this.validateSnapshot(body);
    if (this.repository.count(ownerId) >= MAX_SNAPSHOTS) throw new WealthLimitExceededException();
    const snapshot = this.repository.insert(ownerId, input);
    this.logger.log({
      event: 'WealthSnapshotCreated',
      id: snapshot.id,
      entries: snapshot.entries.length,
    });
    return snapshot;
  }

  update(ownerId: string, id: string, body: unknown): WealthSnapshot {
    const input = this.validateSnapshot(body);
    const snapshot = this.repository.update(ownerId, id, input);
    if (!snapshot) throw new WealthSnapshotNotFoundException();
    this.logger.log({
      event: 'WealthSnapshotUpdated',
      id,
      entries: snapshot.entries.length,
    });
    return snapshot;
  }

  delete(ownerId: string, id: string): void {
    if (!this.repository.delete(ownerId, id)) throw new WealthSnapshotNotFoundException();
    this.logger.log({ event: 'WealthSnapshotDeleted', id });
  }

  getSettings(ownerId: string): WealthSettings {
    return this.repository.getSettings(ownerId);
  }

  /** Replaces the assignment of `(side, class identity)` and returns the new settings. */
  upsertClassGroup(ownerId: string, body: unknown): WealthSettings {
    const result = validateClassGroup(body);
    if (!result.ok) throw new WealthValidationException(result.issues);
    const assignment = result.value;
    const key = classKey(assignment.side, assignment.class);
    const { classGroups } = this.repository.getSettings(ownerId);
    const next = [
      ...classGroups.filter((existing) => classKey(existing.side, existing.class) !== key),
      assignment,
    ];
    const settings = this.repository.saveSettings(ownerId, { classGroups: next });
    this.logger.log({ event: 'WealthClassGroupSaved', assignments: settings.classGroups.length });
    return settings;
  }

  deleteAll(ownerId: string): void {
    const count = this.repository.deleteAllForOwner(ownerId);
    this.logger.log({ event: 'WealthDeletedAll', count });
  }

  private validateSnapshot(body: unknown) {
    const result = validateSnapshotInput(body, new Date().toISOString().slice(0, 10));
    if (!result.ok) throw new WealthValidationException(result.issues);
    return result.value;
  }
}
