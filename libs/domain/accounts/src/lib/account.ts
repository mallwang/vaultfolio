import type { AccountCategory } from './account-category.js';

/**
 * The core entity (spec.md's "Account" Key Entity, data-model.md's Account
 * table): one row per bank, neobroker, depot, credit card, or similar
 * reference-only container. Framework-independent (Principle I) — no
 * NestJS/Angular/SQLite-row concerns here, mirroring `libs/domain/holdings`'s
 * `Holding` shape. Unlike `Holding`, no field here is monetary — every value
 * is plain text (FR-012, no balances/totals).
 */
export interface AccountProps {
  /** Generated at creation (`randomUUID()`), never client-supplied. */
  readonly id: string;
  /** Non-empty after trimming (FR-006). The only required field. */
  readonly name: string;
  /** Defaults to `OTHER` when omitted (FR-007/FR-008). */
  readonly category: AccountCategory;
  readonly provider: string | null;
  /** Stored/displayed as entered, not validated as a live/reachable URL. */
  readonly website: string | null;
  readonly purpose: string | null;
  readonly cardUsage: string | null;
  readonly requiredMinimum: string | null;
  readonly notes: string | null;
  /** Set by the backend from the authenticated session; never client-supplied. */
  readonly ownerId: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export class Account implements AccountProps {
  readonly id: string;
  readonly name: string;
  readonly category: AccountCategory;
  readonly provider: string | null;
  readonly website: string | null;
  readonly purpose: string | null;
  readonly cardUsage: string | null;
  readonly requiredMinimum: string | null;
  readonly notes: string | null;
  readonly ownerId: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  constructor(props: AccountProps) {
    this.id = props.id;
    this.name = props.name;
    this.category = props.category;
    this.provider = props.provider;
    this.website = props.website;
    this.purpose = props.purpose;
    this.cardUsage = props.cardUsage;
    this.requiredMinimum = props.requiredMinimum;
    this.notes = props.notes;
    this.ownerId = props.ownerId;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }
}
