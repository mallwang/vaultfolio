import { Injectable } from '@nestjs/common';
import type { FeedbackCategory, FeedbackLanguage } from '@vaultfolio/api-contract';
import { DatabaseService } from '../database/database.service';
import { FEEDBACK_TABLE, FeedbackCryptoService } from './feedback-crypto.service';

export interface FeedbackPayload {
  subject: string;
  message: string;
}

export interface StoredFeedback {
  id: string;
  category: FeedbackCategory;
  language: FeedbackLanguage;
  createdAt: string;
}

interface Row {
  id: string;
  owner_id: string;
  category: FeedbackCategory;
  language: FeedbackLanguage;
  payload_enc: string;
  created_at: string;
}

/** Raw queries for `feedback_submissions`; every method is scoped by `owner_id`. */
@Injectable()
export class FeedbackRepository {
  constructor(
    private readonly database: DatabaseService,
    private readonly crypto: FeedbackCryptoService,
  ) {}

  async insert(
    row: Omit<StoredFeedback, 'createdAt'> & { createdAt?: string },
    ownerId: string,
    payload: FeedbackPayload,
  ): Promise<void> {
    await this.database.query(
      `INSERT INTO ${FEEDBACK_TABLE}
         (id, owner_id, category, language, payload_enc, key_version, created_at)
       VALUES ($1, $2, $3, $4, $5, ${this.crypto.keyVersion}, $6)`,
      [
        row.id,
        ownerId,
        row.category,
        row.language,
        this.crypto.encrypt(row.id, ownerId, payload),
        row.createdAt ?? new Date().toISOString(),
      ],
    );
  }

  /** Includes the decrypted subject + message. */
  async findById(id: string, ownerId: string): Promise<(StoredFeedback & FeedbackPayload) | null> {
    const rows = await this.database.query<Row>(
      `SELECT * FROM ${FEEDBACK_TABLE} WHERE id = $1 AND owner_id = $2`,
      [id, ownerId],
    );
    return rows[0]
      ? {
          ...toStored(rows[0]),
          ...this.crypto.decrypt<FeedbackPayload>(id, ownerId, rows[0].payload_enc),
        }
      : null;
  }

  /** Rows with `created_at` strictly after `sinceIso`, oldest first. */
  async listSince(ownerId: string, sinceIso: string): Promise<StoredFeedback[]> {
    const rows = await this.database.query<Row>(
      `SELECT * FROM ${FEEDBACK_TABLE} WHERE owner_id = $1 AND created_at > $2
       ORDER BY created_at ASC, rowid`,
      [ownerId, sinceIso],
    );
    return rows.map(toStored);
  }
}

function toStored(row: Row): StoredFeedback {
  return {
    id: row.id,
    category: row.category,
    language: row.language,
    createdAt: row.created_at,
  };
}
