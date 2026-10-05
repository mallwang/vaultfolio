import type { Contract, InsuranceContract } from '../model';

export function buildContract(overrides: Partial<Contract> = {}): Contract {
  return {
    type: 'PRIVATE_LIABILITY',
    name: 'Privathaftpflicht',
    status: 'ACTIVE',
    startDate: '2025-01-01',
    premium: '96.00',
    interval: 'YEARLY',
    cancellation: { autoRenew: true, period: { value: 3, unit: 'MONTHS' } },
    reminderEnabled: true,
    ...overrides,
  };
}

export function buildInsuranceContract(
  overrides: Partial<InsuranceContract> = {},
): InsuranceContract {
  return {
    ...buildContract(),
    id: 'contract-1',
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    ...overrides,
  };
}
