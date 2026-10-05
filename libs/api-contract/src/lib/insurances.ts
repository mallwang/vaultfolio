/**
 * Shared contract for the Insurances API — see
 * specs/039-insurances-management/contracts/insurances-api.md and data-model.md. Plain TypeScript
 * interfaces, no runtime dependency, imported by `apps/backend` and
 * `libs/frontend/domain/insurances` so the tiers can never drift on shape (Principle II).
 *
 * Amounts are canonical decimal strings with two fractional digits (`"96.00"`), never JSON
 * numbers. Derived values (monthly cost, deadlines, totals, gap check) are computed in
 * `@vaultfolio/insurances` and never appear in a response.
 */

export type InsuranceTypeId =
  | 'STATUTORY_HEALTH'
  | 'STATUTORY_CARE'
  | 'STATUTORY_PENSION'
  | 'STATUTORY_UNEMPLOYMENT'
  | 'PRIVATE_HEALTH'
  | 'SUPPLEMENTARY_HEALTH'
  | 'DENTAL_SUPPLEMENT'
  | 'TRAVEL_HEALTH'
  | 'LONG_TERM_CARE'
  | 'DISABILITY'
  | 'TERM_LIFE'
  | 'ACCIDENT'
  | 'PRIVATE_LIABILITY'
  | 'PET_LIABILITY'
  | 'PROPERTY_OWNER_LIABILITY'
  | 'HOUSEHOLD'
  | 'BUILDING'
  | 'NATURAL_HAZARD'
  | 'GLASS'
  | 'CAR'
  | 'BICYCLE'
  | 'LEGAL_PROTECTION'
  | 'OTHER';

export type InsurancePaymentInterval = 'MONTHLY' | 'QUARTERLY' | 'HALF_YEARLY' | 'YEARLY';
export type InsuranceContractStatus = 'ACTIVE' | 'CANCELLED' | 'ENDED';
export type InsuranceEmployment = 'EMPLOYED' | 'SELF_EMPLOYED' | 'CIVIL_SERVANT' | 'OTHER';
export type InsuranceSocialKind = 'HEALTH' | 'CARE' | 'PENSION' | 'UNEMPLOYMENT';

export type InsuranceRequirementId =
  | 'HEALTH'
  | 'LIABILITY'
  | 'HOUSEHOLD'
  | 'DISABILITY'
  | 'BUILDING'
  | 'NATURAL_HAZARD'
  | 'CAR'
  | 'PET_LIABILITY'
  | 'TRAVEL_HEALTH'
  | 'RISK_LIFE'
  | 'LEGAL'
  | 'PROPERTY_OWNER_LIABILITY';

export interface InsuranceCancellation {
  period?: { value: number; unit: 'WEEKS' | 'MONTHS' };
  autoRenew: boolean;
  renewalMonths?: number;
  minimumTermMonths?: number;
  fixedDate?: { day: number; month: number };
}

export interface InsuranceContractDetails {
  coverageSum?: string;
  deductible?: string;
  insuredMonthlyBenefit?: string;
  insuredSum?: string;
  licensePlate?: string;
  noClaimsClass?: string;
}

/** Body of `POST`/`PUT /insurances/contracts`: no id, no timestamps. */
export interface InsuranceContractInput {
  type: InsuranceTypeId;
  alsoCovers?: InsuranceTypeId[];
  name: string;
  insurer?: string;
  contractNumber?: string;
  status: InsuranceContractStatus;
  /** `YYYY-MM-DD`. */
  startDate: string;
  endDate?: string;
  premium: string;
  interval: InsurancePaymentInterval;
  paymentMonth?: number;
  cancellation: InsuranceCancellation;
  reminderEnabled: boolean;
  details?: InsuranceContractDetails;
  note?: string;
}

export interface InsuranceContract extends InsuranceContractInput {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export interface InsuranceProfile {
  ownsProperty: boolean;
  ownsCar: boolean;
  hasChildren: boolean;
  hasPets: boolean;
  travelsAbroad: boolean;
  employment: InsuranceEmployment;
}

export interface InsuranceSettings {
  profile: InsuranceProfile;
  reminders: { enabled: boolean; leadDays: number };
  dismissedRequirements: InsuranceRequirementId[];
  includeSocial: boolean;
}

export interface InsuranceLinkedSocialLine {
  kind: InsuranceSocialKind;
  monthly: string;
  /** `YYYY-MM`. */
  period: string;
}

export interface InsurancesData {
  contracts: InsuranceContract[];
  linkedSocial: InsuranceLinkedSocialLine[];
  settings: InsuranceSettings;
  /** Server date `YYYY-MM-DD`, used by the client for deadline math. */
  today: string;
}

/** Error codes (`error` field of the error body). */
export const INSURANCES_ERROR = {
  validation: 'INSURANCES_VALIDATION',
  unknownField: 'INSURANCES_UNKNOWN_FIELD',
  limitExceeded: 'INSURANCES_LIMIT_EXCEEDED',
  contractNotFound: 'INSURANCES_CONTRACT_NOT_FOUND',
  unavailable: 'INSURANCES_UNAVAILABLE',
} as const;

export type InsurancesErrorCode = (typeof INSURANCES_ERROR)[keyof typeof INSURANCES_ERROR];
