import { Injectable, Logger } from '@nestjs/common';
import type { DomainKeyStatus, EncryptionDomainId, RotationRun } from '@vaultfolio/api-contract';
import {
  deriveRotationFlags,
  keyFingerprint,
  unwrapDataKey,
  wrapDataKey,
} from '@vaultfolio/encryption';
import { DatabaseService } from '../database/database.service';
import { DOMAIN_ENCRYPTION } from './domain-encryption.registry';
import { DomainKeyringService } from './domain-keyring.service';
import {
  EncryptionConfirmationMismatchException,
  EncryptionDomainNotFoundException,
  EncryptionDomainNotReadyException,
  EncryptionKeyInUseException,
  EncryptionKeyNotRetiredException,
  EncryptionOperationRunningException,
} from './encryption.exceptions';
import { KeyStoreRepository } from './key-store.repository';
import { REENCRYPTION_BATCH_SIZE } from './legacy-migration.service';

export interface Actor {
  userId: string;
  email: string | null;
}

const yieldToEventLoop = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

/** Admin operations: master key re-wrap, data key re-encryption, destroying retired keys, status. */
@Injectable()
export class RotationService {
  private readonly logger = new Logger(RotationService.name);

  constructor(
    private readonly keyring: DomainKeyringService,
    private readonly store: KeyStoreRepository,
    private readonly database: DatabaseService,
  ) {}

  /** Looks up the acting admin's e-mail for the history snapshot. */
  actorFor(userId: string): Actor {
    const [row] = this.database.querySync<{ email: string }>(
      'SELECT email FROM users WHERE id = $1',
      [userId],
    );
    return { userId, email: row?.email ?? null };
  }

  status(): DomainKeyStatus[] {
    return DOMAIN_ENCRYPTION.map((d) => this.statusOf(d.id));
  }

  history(domain: EncryptionDomainId | undefined, limit: number): RotationRun[] {
    return this.store.history(domain, limit);
  }

  private statusOf(domain: EncryptionDomainId): DomainKeyStatus {
    const runtime = this.keyring.runtime(domain);
    const keys = this.store.listDataKeys(domain).filter((k) => k.status !== 'destroyed');
    const flags = deriveRotationFlags(
      keys.map((k) => k.kekFingerprint ?? ''),
      runtime.current ? keyFingerprint(runtime.current) : null,
      runtime.previous ? keyFingerprint(runtime.previous) : null,
    );
    return {
      domain,
      state: this.keyring.state(domain),
      currentVersion: runtime.ring.currentVersion,
      retiredVersions: keys.filter((k) => k.status === 'retired').map((k) => k.version),
      ...flags,
      rowsPerVersion: this.store.countRowsPerVersion(domain),
      lastRun: this.store.lastRun(domain),
      runningRun: this.store.runningRun(domain),
    };
  }

  /** Re-wraps every non-destroyed data key under the current master key; idempotent. */
  rotateMasterKey(domain: EncryptionDomainId, actor: Actor): RotationRun {
    const runtime = this.requireReady(domain);
    const run = this.begin(domain, 'MASTER_KEY', actor, {});
    try {
      const currentFp = keyFingerprint(runtime.current as Buffer);
      const byFingerprint = new Map<string, Buffer>([[currentFp, runtime.current as Buffer]]);
      if (runtime.previous) byFingerprint.set(keyFingerprint(runtime.previous), runtime.previous);

      // Unwrap everything first so an unknown or damaged key changes nothing.
      const rewraps = this.store
        .listDataKeys(domain)
        .filter((k) => k.status !== 'destroyed' && k.kekFingerprint !== currentFp)
        .map((k) => {
          const master = byFingerprint.get(k.kekFingerprint ?? '');
          if (!master || !k.wrappedDek) throw new Error('KEY_MISMATCH');
          const dek = unwrapDataKey(master, domain, k.version, k.wrappedDek);
          return {
            version: k.version,
            wrapped: wrapDataKey(runtime.current as Buffer, domain, k.version, dek),
          };
        });
      this.database.transaction(() => {
        for (const r of rewraps) this.store.updateWrapping(domain, r.version, r.wrapped, currentFp);
      });
      this.store.updateProgress(run.id, rewraps.length);
      return this.store.finishRun(run.id, 'SUCCEEDED');
    } catch {
      this.store.finishRun(run.id, 'FAILED', 'KEY_MISMATCH');
      throw new EncryptionDomainNotReadyException();
    }
  }

  /**
   * Creates data key N+1, locks the domain and re-encrypts every row in the background. Returns the
   * RUNNING run immediately; progress is visible through the status endpoint.
   */
  startReencryption(domain: EncryptionDomainId, confirm: string, actor: Actor): RotationRun {
    if (confirm !== domain) throw new EncryptionConfirmationMismatchException();
    const runtime = this.requireReady(domain);
    const fromVersion = runtime.ring.currentVersion as number;
    const run = this.database.transaction(() => {
      const created = this.begin(domain, 'DATA_KEY', actor, { fromVersion });
      const toVersion = this.keyring.createCurrentKey(runtime);
      this.store.updateToVersion(created.id, toVersion);
      this.store.updateProgress(created.id, 0, this.store.countRowsBelow(domain, toVersion));
      this.keyring.setReencrypting(domain, true);
      return this.store.getRun(created.id) as RotationRun;
    });
    void this.reencryptInBackground(domain, run.id);
    return run;
  }

  private async reencryptInBackground(domain: EncryptionDomainId, runId: string): Promise<void> {
    const runtime = this.keyring.runtime(domain);
    let done = 0;
    try {
      for (;;) {
        await yieldToEventLoop();
        const moved = this.store.reencryptBatch(domain, runtime.ring, REENCRYPTION_BATCH_SIZE);
        if (moved === 0) break;
        done += moved;
        this.store.updateProgress(runId, done);
      }
      this.store.updateToVersion(runId, runtime.ring.currentVersion);
      this.store.finishRun(runId, 'SUCCEEDED');
      this.logger.log({ event: 'EncryptionReencryptionDone', domain, rows: done });
    } catch {
      // Rows stay readable (both data keys exist); re-running continues where it stopped.
      this.store.finishRun(runId, 'FAILED', 'DB_ERROR');
      this.logger.error({ event: 'EncryptionReencryptionFailed', domain });
    } finally {
      this.keyring.setReencrypting(domain, false);
    }
  }

  /** Destroys a retired data key, refused while any row still carries its version. */
  destroyDataKey(domain: EncryptionDomainId, version: number, actor: Actor): RotationRun {
    const runtime = this.keyring.runtime(domain);
    const key = this.store.listDataKeys(domain).find((k) => k.version === version);
    if (!key) throw new EncryptionDomainNotFoundException();
    if (key.status !== 'retired') throw new EncryptionKeyNotRetiredException();
    if (this.store.runningRun(domain)) throw new EncryptionOperationRunningException();
    if (this.store.countRowsAtVersion(domain, version) > 0) throw new EncryptionKeyInUseException();
    const run = this.begin(domain, 'KEY_DESTROY', actor, {
      fromVersion: version,
      toVersion: version,
    });
    this.store.markDestroyed(domain, version);
    runtime.ring.removeDataKey(version);
    return this.store.finishRun(run.id, 'SUCCEEDED');
  }

  private requireReady(domain: EncryptionDomainId) {
    if (!this.keyring.isAvailable(domain)) throw new EncryptionDomainNotReadyException();
    if (this.store.runningRun(domain)) throw new EncryptionOperationRunningException();
    return this.keyring.runtime(domain);
  }

  private begin(
    domain: EncryptionDomainId,
    kind: RotationRun['kind'],
    actor: Actor,
    versions: { fromVersion?: number; toVersion?: number },
  ): RotationRun {
    return this.store.createRun({
      domain,
      kind,
      triggeredByUserId: actor.userId,
      triggeredByEmail: actor.email,
      fromVersion: versions.fromVersion ?? null,
      toVersion: versions.toVersion ?? null,
    });
  }
}
