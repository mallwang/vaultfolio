import type { RetirementRecord, RetirementFigures } from '@vaultfolio/api-contract';
import { type ContractType, pillarOf } from '../model';

/** Invented, internally consistent figures per contract type (no real personal data). */
export const SAMPLE_FIGURES: Readonly<Record<ContractType, RetirementFigures>> = {
  STATUTORY_PENSION: {
    dataPeriodFrom: '1995-01-01',
    dataPeriodTo: '2025-12-31',
    fullDisabilityMonthly: '1500.00',
    accruedMonthly: '1200.00',
    projectedMonthly: '2000.00',
    projectedAt1Pct: '2400.00',
    projectedAt2Pct: '2900.00',
    earningsPoints: '30.0000',
    currentPensionValue: '40.00',
    contributionsOwn: '30000.00',
    contributionsEmployer: '30000.00',
    contributionsPublic: '1000.00',
  },
  DIRECT_INSURANCE: {
    guaranteedMonthly: '200.00',
    expectedMonthly: '280.00',
    guaranteedCapital: '45000.00',
    currentValue: '12000.00',
    contributionMonthly: '100.00',
    employerContributionMonthly: '60.00',
  },
  PENSIONSKASSE: {
    guaranteedMonthly: '150.00',
    expectedMonthly: '190.00',
    contributionMonthly: '80.00',
    employerContributionMonthly: '80.00',
  },
  DIREKTZUSAGE: { guaranteedMonthly: '120.00', expectedMonthly: '120.00' },
  UNTERSTUETZUNGSKASSE: { guaranteedMonthly: '90.00', expectedMonthly: '110.00' },
  PENSIONSFONDS: {
    guaranteedMonthly: '70.00',
    expectedMonthly: '95.00',
    employerContributionMonthly: '50.00',
  },
  CAPITAL_ACCOUNT: {
    openingBalance: '10000.00',
    guaranteedInterestRate: '1.2500',
    interestCredit: '125.00',
    annualContribution: '1200.00',
    accountBalance: '11325.00',
    finalBonus: '900.00',
    contributionMonthly: '100.00',
  },
  RIESTER: {
    guaranteedMonthly: '100.00',
    expectedMonthly: '150.00',
    guaranteedCapital: '28000.00',
    scenarioMonthly: { '0': '110.00', '3': '150.00', '6': '200.00', '9': '260.00' },
    currentValue: '9000.00',
    contributionsPaid: '10000.00',
    contributionsMain: '9000.00',
    contributionsExtra: '1000.00',
    surrenderValue: '8500.00',
    deathBenefit: '9000.00',
    guaranteePeriodYears: 10,
    contributionMonthly: '60.00',
    subsidiesYearly: '175.00',
  },
  PRIVATE_PENSION_INSURANCE: {
    guaranteedMonthly: '180.00',
    expectedMonthly: '260.00',
    currentValue: '20000.00',
    contributionMonthly: '150.00',
  },
  ALTERSVORSORGEDEPOT: {
    currentValue: '5000.00',
    expectedMonthly: '40.00',
    contributionMonthly: '50.00',
  },
};

/**
 * A stored-record view with sensible defaults for `contractType` (default `RIESTER`); override any
 * field. Figures default to {@link SAMPLE_FIGURES} of the type and are replaced, not merged.
 */
export function buildRecord(overrides: Partial<RetirementRecord> = {}): RetirementRecord {
  const contractType = overrides.contractType ?? 'RIESTER';
  const pillar = pillarOf(contractType);
  return {
    id: 'record-1',
    pillar,
    contractType,
    origin: 'MANUAL',
    status: 'ACTIVE',
    providerLabel: pillar === 'STATUTORY' ? null : 'Muster Versicherung',
    statementDate: '2026-04-01',
    payoutStart: pillar === 'STATUTORY' ? '2056-03-01' : '2050-01-01',
    identifier: null,
    figures: SAMPLE_FIGURES[contractType],
    supplement: null,
    import: null,
    createdAt: '2026-04-02T10:00:00.000Z',
    updatedAt: '2026-04-02T10:00:00.000Z',
    ...overrides,
  };
}
