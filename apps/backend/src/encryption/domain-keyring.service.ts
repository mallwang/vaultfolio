import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { EncryptionDomainId } from '@vaultfolio/api-contract';
import {
  EnvelopeDecryptionError,
  Keyring,
  decodeMasterKey,
  deriveDomainState,
  generateDataKey,
  keyFingerprint,
  unwrapDataKey,
  wrapDataKey,
  type DomainState,
} from '@vaultfolio/encryption';
import {
  DOMAIN_ENCRYPTION,
  MASTER_KEY_ENV,
  MASTER_KEY_PREVIOUS_ENV,
  type DomainEncryption,
} from './domain-encryption.registry';
import { KeyStoreRepository, type StoredDataKey } from './key-store.repository';
import { LegacyMigrationService } from './legacy-migration.service';

/** Raised when a domain cannot encrypt or decrypt; callers map it to their own 503. */
export class DomainKeyUnavailableError extends Error {
  constructor(readonly domain: string) {
    super(`Encryption is unavailable for domain ${domain}`);
  }
}

/** Mutable per-domain state; owned by {@link DomainKeyringService}, read by the rotation service. */
export interface DomainRuntime {
  readonly definition: DomainEncryption;
  readonly ring: Keyring;
  current: Buffer | null;
  /** The previous master key while a rotation is pending. */
  previous: Buffer[];
  mismatch: boolean;
  migrating: boolean;
  reencrypting: boolean;
}

/**
 * Per-domain envelope keyring: verifies the configured master key against stored key material at
 * boot, holds the unwrapped data keys in RAM and encrypts/decrypts rows. Any domain that is not
 * `READY` refuses all reads and writes (fail closed, FR-007); other domains are unaffected.
 */
@Injectable()
export class DomainKeyringService implements OnModuleInit {
  private readonly logger = new Logger(DomainKeyringService.name);
  private readonly runtimes = new Map<EncryptionDomainId, DomainRuntime>();

  constructor(
    private readonly store: KeyStoreRepository,
    private readonly legacy: LegacyMigrationService,
  ) {
    for (const definition of DOMAIN_ENCRYPTION) {
      this.runtimes.set(definition.id, {
        definition,
        ring: new Keyring(),
        current: null,
        previous: [],
        mismatch: false,
        migrating: false,
        reencrypting: false,
      });
    }
  }

  onModuleInit(): void {
    try {
      this.store.markLeftoverRunsInterrupted();
    } catch (error) {
      this.logger.error('Encryption key store is not readable — encrypted domains stay locked');
      this.logger.debug((error as Error).message);
      for (const r of this.runtimes.values()) {
        r.current = decodeMasterKey(process.env[MASTER_KEY_ENV]);
        r.mismatch = true;
      }
      return;
    }
    for (const runtime of this.runtimes.values()) {
      this.initDomain(runtime);
    }
  }

  runtime(domain: EncryptionDomainId): DomainRuntime {
    return this.runtimes.get(domain) as DomainRuntime;
  }

  state(domain: EncryptionDomainId): DomainState {
    const r = this.runtime(domain);
    return deriveDomainState({
      masterKeyConfigured: r.current !== null,
      mismatch: r.mismatch,
      migrating: r.migrating,
      reencrypting: r.reencrypting,
    });
  }

  isAvailable(domain: EncryptionDomainId): boolean {
    return this.state(domain) === 'READY';
  }

  /** Data key version new rows are written with (the `key_version` column value). */
  currentVersion(domain: EncryptionDomainId): number {
    return this.runtime(domain).ring.currentVersion ?? 1;
  }

  encrypt(domain: EncryptionDomainId, aad: string, payload: unknown): string {
    this.requireAvailable(domain);
    return this.runtime(domain).ring.encrypt(aad, payload);
  }

  decrypt<T>(domain: EncryptionDomainId, aad: string, encoded: string): T {
    this.requireAvailable(domain);
    try {
      return this.runtime(domain).ring.decrypt<T>(aad, encoded);
    } catch (error) {
      if (error instanceof EnvelopeDecryptionError) {
        // Fail closed: never return partial data, never log the ciphertext or the row.
        this.runtime(domain).mismatch = true;
        this.logger.error({ event: 'EncryptionDecryptFailed', domain });
        throw new DomainKeyUnavailableError(domain);
      }
      throw error;
    }
  }

  /** Locks (or unlocks) the domain while a re-encryption runs. */
  setReencrypting(domain: EncryptionDomainId, value: boolean): void {
    this.runtime(domain).reencrypting = value;
  }

  private requireAvailable(domain: EncryptionDomainId): void {
    if (!this.isAvailable(domain)) {
      throw new DomainKeyUnavailableError(domain);
    }
  }

  private initDomain(r: DomainRuntime): void {
    const { id } = r.definition;
    try {
      r.current = decodeMasterKey(process.env[MASTER_KEY_ENV]);
      if (!r.current) {
        this.logger.warn(
          `${MASTER_KEY_ENV} is missing or not base64 of 32 bytes — domain ${id} is unavailable`,
        );
        return;
      }
      const currentFp = keyFingerprint(r.current);
      const seen = new Set<string>([currentFp]);
      const previous = decodeMasterKey(process.env[MASTER_KEY_PREVIOUS_ENV]);
      if (previous && !seen.has(keyFingerprint(previous))) r.previous.push(previous);
      this.loadKeys(r);
    } catch (error) {
      r.mismatch = true;
      this.logger.error({ event: 'EncryptionDomainInitFailed', domain: id });
      this.logger.debug((error as Error).message);
    }
  }

  private loadKeys(r: DomainRuntime): void {
    const { id } = r.definition;
    const stored = this.store.listDataKeys(id);
    if (!this.unwrapStored(r, stored)) {
      r.mismatch = true;
      this.logger.error(
        `${MASTER_KEY_ENV} does not open the stored data keys of domain ${id}` +
          ` (if the key was rotated, set the old key as ${MASTER_KEY_PREVIOUS_ENV}) — domain locked`,
      );
      return;
    }

    const hasLegacy = this.legacy.hasLegacyRows(id);
    if (hasLegacy) {
      const candidates = [r.current as Buffer, ...r.previous];
      const legacyKey = this.legacy.proveLegacyKey(id, candidates);
      if (!legacyKey) {
        r.mismatch = true;
        this.logger.error(
          `No configured key matches the stored ${id} data (if the key was rotated, set the old key as ${MASTER_KEY_PREVIOUS_ENV}) — domain locked, nothing written`,
        );
        return;
      }
      r.ring.setLegacyKey(legacyKey);
    }

    if (r.ring.currentVersion === null) {
      this.createCurrentKey(r);
    }

    if (hasLegacy) {
      this.migrateLegacy(r);
    }
    this.warnAboutPreviousKeys(r);
  }

  private migrateLegacy(r: DomainRuntime): void {
    r.migrating = true;
    try {
      this.legacy.migrate(r.definition.id, r.ring);
      r.ring.setLegacyKey(null);
    } catch {
      // Rows stay readable through the legacy key; the next start retries.
      this.logger.error({ event: 'EncryptionLegacyMigrationFailed', domain: r.definition.id });
    } finally {
      r.migrating = false;
    }
  }

  /** Unwraps every non-destroyed data key; `false` when any does not open with a configured key. */
  private unwrapStored(r: DomainRuntime, stored: readonly StoredDataKey[]): boolean {
    const byFingerprint = new Map<string, Buffer>();
    byFingerprint.set(keyFingerprint(r.current as Buffer), r.current as Buffer);
    for (const k of r.previous) byFingerprint.set(keyFingerprint(k), k);
    for (const key of stored) {
      if (key.status === 'destroyed' || !key.wrappedDek) continue;
      const master = byFingerprint.get(key.kekFingerprint ?? '');
      if (!master) return false;
      try {
        r.ring.addDataKey(
          key.version,
          unwrapDataKey(master, r.definition.id, key.version, key.wrappedDek),
          key.status === 'current',
        );
      } catch {
        return false;
      }
    }
    return true;
  }

  /** Bootstraps data key `highest + 1` (version 2 for a fresh domain) wrapped under the current master key. */
  createCurrentKey(r: DomainRuntime): number {
    const id = r.definition.id;
    const version = this.store.highestVersion(id) + 1;
    const dek = generateDataKey();
    this.store.retireCurrent(id);
    this.store.insertDataKey(
      id,
      version,
      wrapDataKey(r.current as Buffer, id, version, dek),
      keyFingerprint(r.current as Buffer),
      'current',
    );
    r.ring.addDataKey(version, dek, true);
    return version;
  }

  private warnAboutPreviousKeys(r: DomainRuntime): void {
    if (r.previous.length === 0) return;
    const previousFps = new Set(r.previous.map((k) => keyFingerprint(k)));
    const pending = this.store
      .listDataKeys(r.definition.id)
      .some((k) => k.status !== 'destroyed' && previousFps.has(k.kekFingerprint ?? ''));
    this.logger.warn(
      pending
        ? `${MASTER_KEY_PREVIOUS_ENV} is still needed for domain ${r.definition.id}: run the master key rotation`
        : `${MASTER_KEY_PREVIOUS_ENV} is no longer needed for domain ${r.definition.id} and can be removed`,
    );
  }
}
