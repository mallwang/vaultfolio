import { ENCRYPTION_DOMAIN_IDS } from '@vaultfolio/api-contract';
import { DOMAIN_ENCRYPTION, findDomain, isDomainId, rowAad } from './domain-encryption.registry';

describe('DOMAIN_ENCRYPTION', () => {
  it('registers exactly the five domains of the contract', () => {
    expect(DOMAIN_ENCRYPTION.map((d) => d.id)).toEqual([...ENCRYPTION_DOMAIN_IDS]);
  });

  it.each([
    [
      'earnings',
      'EARNINGS_ENCRYPTION_KEY',
      ['earnings_records:amounts_enc', 'earnings_certificates:amounts_enc'],
    ],
    ['retirement', 'RETIREMENT_ENCRYPTION_KEY', ['retirement_records:payload_enc']],
    [
      'wealth',
      'WEALTH_ENCRYPTION_KEY',
      ['wealth_snapshots:payload_enc', 'wealth_settings:payload_enc'],
    ],
    [
      'insurances',
      'INSURANCES_ENCRYPTION_KEY',
      ['insurance_contracts:payload_enc', 'insurance_settings:payload_enc'],
    ],
    [
      'account-overview',
      'ACCOUNT_OVERVIEW_ENCRYPTION_KEY',
      ['account_overview_entries:payload_enc'],
    ],
  ])('%s: env variables and tables', (id, env, tables) => {
    const domain = findDomain(id);
    expect(domain?.currentKeyEnv).toBe(env);
    expect(domain?.previousKeyEnv).toBe(`${env}_PREVIOUS`);
    expect(domain?.tables.map((t) => `${t.table}:${t.ciphertextColumn}`)).toEqual(tables);
  });

  it('uses the owner id as row id for settings tables only', () => {
    const settings = DOMAIN_ENCRYPTION.flatMap((d) => d.tables).filter(
      (t) => t.idColumn === 'owner_id',
    );
    expect(settings.map((t) => t.table).sort()).toEqual(['insurance_settings', 'wealth_settings']);
  });

  it('builds the row-bound AAD', () => {
    expect(rowAad('wealth_snapshots', 'r1', 'u1')).toBe('wealth_snapshots|r1|u1');
  });

  it('recognises domain ids', () => {
    expect(isDomainId('wealth')).toBe(true);
    expect(isDomainId('nope')).toBe(false);
    expect(findDomain('nope')).toBeUndefined();
  });
});
