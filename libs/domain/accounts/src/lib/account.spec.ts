import { Account } from './account.js';
import type { AccountProps } from './account.js';

/** Exercises `Account`'s construction/shape, mirroring `holding.spec.ts`. */

const baseProps: AccountProps = {
  id: 'a1',
  name: 'N26 checking',
  category: 'CREDIT_CARD',
  status: 'ACTIVE',
  provider: 'N26',
  website: 'https://n26.com',
  purpose: 'Everyday spending',
  cardUsage: 'Contactless only',
  requiredMinimum: null,
  notes: null,
  cardNumber: '4111 1111 1111 1111',
  validUntil: '09/28',
  ownerId: 'owner-1',
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-02'),
};

describe('Account', () => {
  it('constructs with every field assigned from its props', () => {
    const account = new Account(baseProps);

    expect(account.id).toBe('a1');
    expect(account.name).toBe('N26 checking');
    expect(account.category).toBe('CREDIT_CARD');
    expect(account.status).toBe('ACTIVE');
    expect(account.provider).toBe('N26');
    expect(account.website).toBe('https://n26.com');
    expect(account.purpose).toBe('Everyday spending');
    expect(account.cardUsage).toBe('Contactless only');
    expect(account.requiredMinimum).toBeNull();
    expect(account.notes).toBeNull();
    expect(account.cardNumber).toBe('4111 1111 1111 1111');
    expect(account.validUntil).toBe('09/28');
    expect(account.ownerId).toBe('owner-1');
    expect(account.createdAt).toEqual(new Date('2026-01-01'));
    expect(account.updatedAt).toEqual(new Date('2026-01-02'));
  });

  it('allows every optional field to be null', () => {
    const account = new Account({
      ...baseProps,
      provider: null,
      website: null,
      purpose: null,
      cardUsage: null,
      requiredMinimum: null,
      notes: null,
      cardNumber: null,
      validUntil: null,
      ownerId: null,
    });

    expect(account.provider).toBeNull();
    expect(account.website).toBeNull();
    expect(account.purpose).toBeNull();
    expect(account.cardUsage).toBeNull();
    expect(account.requiredMinimum).toBeNull();
    expect(account.notes).toBeNull();
    expect(account.cardNumber).toBeNull();
    expect(account.validUntil).toBeNull();
    expect(account.ownerId).toBeNull();
  });
});
