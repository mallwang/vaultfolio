import { ENCRYPTION_DOMAIN_IDS, type EncryptionDomainId } from '@vaultfolio/api-contract';

/** One encrypted table: column names are fixed identifiers, never user input. */
export interface EncryptedTable {
  table: string;
  idColumn: string;
  ownerColumn: string;
  ciphertextColumn: string;
}

/** Operator master key shared by all domains; it only wraps the per-domain data keys. */
export const MASTER_KEY_ENV = 'ENCRYPTION_KEY';
export const MASTER_KEY_PREVIOUS_ENV = 'ENCRYPTION_KEY_PREVIOUS';

export interface DomainEncryption {
  id: EncryptionDomainId;
  tables: readonly EncryptedTable[];
}

const payloadTable = (table: string, idColumn = 'id'): EncryptedTable => ({
  table,
  idColumn,
  ownerColumn: 'owner_id',
  ciphertextColumn: 'payload_enc',
});

/** Single source for startup checks, legacy migration, re-encryption and per-version counts. */
export const DOMAIN_ENCRYPTION: readonly DomainEncryption[] = [
  {
    id: 'earnings',
    tables: [
      {
        table: 'earnings_records',
        idColumn: 'id',
        ownerColumn: 'owner_id',
        ciphertextColumn: 'amounts_enc',
      },
      {
        table: 'earnings_certificates',
        idColumn: 'id',
        ownerColumn: 'owner_id',
        ciphertextColumn: 'amounts_enc',
      },
    ],
  },
  {
    id: 'retirement',
    tables: [payloadTable('retirement_records')],
  },
  {
    id: 'wealth',
    tables: [payloadTable('wealth_snapshots'), payloadTable('wealth_settings', 'owner_id')],
  },
  {
    id: 'insurances',
    tables: [payloadTable('insurance_contracts'), payloadTable('insurance_settings', 'owner_id')],
  },
  {
    id: 'account-overview',
    tables: [payloadTable('account_overview_entries')],
  },
];

export function findDomain(id: string): DomainEncryption | undefined {
  return DOMAIN_ENCRYPTION.find((d) => d.id === id);
}

export function isDomainId(value: string): value is EncryptionDomainId {
  return (ENCRYPTION_DOMAIN_IDS as readonly string[]).includes(value);
}

/** AAD `<table>|<row id>|<owner_id>`; settings tables use the owner id as row id. */
export function rowAad(table: string, id: string, ownerId: string): string {
  return `${table}|${id}|${ownerId}`;
}
