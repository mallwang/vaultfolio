import { Injectable } from '@nestjs/common';
import {
  DomainKeyUnavailableError,
  DomainKeyringService,
} from '../encryption/domain-keyring.service';
import { rowAad } from '../encryption/domain-encryption.registry';
import { FeedbackUnavailableException } from './feedback.exceptions';

export const FEEDBACK_TABLE = 'feedback_submissions';

/** Envelope encryption of the stored subject + message; AAD `<table>|<id>|<owner_id>`. */
@Injectable()
export class FeedbackCryptoService {
  constructor(private readonly keyring: DomainKeyringService) {}

  get available(): boolean {
    return this.keyring.isAvailable('feedback');
  }

  get keyVersion(): number {
    return this.keyring.currentVersion('feedback');
  }

  encrypt(id: string, ownerId: string, payload: unknown): string {
    try {
      return this.keyring.encrypt('feedback', rowAad(FEEDBACK_TABLE, id, ownerId), payload);
    } catch (error) {
      throw unavailable(error);
    }
  }

  decrypt<T>(id: string, ownerId: string, encoded: string): T {
    try {
      return this.keyring.decrypt<T>('feedback', rowAad(FEEDBACK_TABLE, id, ownerId), encoded);
    } catch (error) {
      throw unavailable(error);
    }
  }
}

function unavailable(error: unknown): unknown {
  return error instanceof DomainKeyUnavailableError ? new FeedbackUnavailableException() : error;
}
