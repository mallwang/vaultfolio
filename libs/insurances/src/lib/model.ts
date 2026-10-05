export type InsuranceGroup = 'PERSONS' | 'LIABILITY' | 'PROPERTY' | 'MOBILITY' | 'LEGAL' | 'OTHER';
export type Classification = 'ESSENTIAL' | 'RECOMMENDED' | 'SITUATIONAL' | 'OPTIONAL';

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

export type PaymentInterval = 'MONTHLY' | 'QUARTERLY' | 'HALF_YEARLY' | 'YEARLY';
export type ContractStatus = 'ACTIVE' | 'CANCELLED' | 'ENDED';
export type Employment = 'EMPLOYED' | 'SELF_EMPLOYED' | 'CIVIL_SERVANT' | 'OTHER';
export type SocialKind = 'HEALTH' | 'CARE' | 'PENSION' | 'UNEMPLOYMENT';

export type RequirementId =
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

export type DetailField =
  | 'coverageSum'
  | 'deductible'
  | 'insuredMonthlyBenefit'
  | 'insuredSum'
  | 'licensePlate'
  | 'noClaimsClass';

export interface CancellationSettings {
  period?: { value: number; unit: 'WEEKS' | 'MONTHS' };
  autoRenew: boolean;
  renewalMonths?: number;
  minimumTermMonths?: number;
  fixedDate?: { day: number; month: number };
}

export interface ContractDetails {
  coverageSum?: string;
  deductible?: string;
  insuredMonthlyBenefit?: string;
  insuredSum?: string;
  licensePlate?: string;
  noClaimsClass?: string;
}

export interface Contract {
  type: InsuranceTypeId;
  alsoCovers?: InsuranceTypeId[];
  name: string;
  insurer?: string;
  contractNumber?: string;
  status: ContractStatus;
  startDate: string;
  endDate?: string;
  premium: string;
  interval: PaymentInterval;
  paymentMonth?: number;
  cancellation: CancellationSettings;
  reminderEnabled: boolean;
  details?: ContractDetails;
  note?: string;
}

export interface InsuranceContract extends Contract {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export interface Profile {
  ownsProperty: boolean;
  ownsCar: boolean;
  hasChildren: boolean;
  hasPets: boolean;
  travelsAbroad: boolean;
  employment: Employment;
}

export interface Settings {
  profile: Profile;
  reminders: { enabled: boolean; leadDays: number };
  dismissedRequirements: RequirementId[];
  includeSocial: boolean;
}

export interface LinkedSocialLine {
  kind: SocialKind;
  monthly: string;
  /** `YYYY-MM`. */
  period: string;
}

export type CancellationInfo =
  | { kind: 'DEADLINE'; date: string; termEnd: string }
  | { kind: 'ENDS'; date: string }
  | { kind: 'ANYTIME'; period?: { value: number; unit: 'WEEKS' | 'MONTHS' } }
  | { kind: 'NONE' };

export const MAX_CONTRACTS = 200;
export const MAX_AMOUNT = '999999999.99';
export const DEFAULT_SETTINGS: Settings = {
  profile: {
    ownsProperty: false,
    ownsCar: false,
    hasChildren: false,
    hasPets: false,
    travelsAbroad: false,
    employment: 'EMPLOYED',
  },
  reminders: { enabled: false, leadDays: 30 },
  dismissedRequirements: [],
  includeSocial: true,
};

export const SOCIAL_TYPE_BY_KIND: Record<SocialKind, InsuranceTypeId> = {
  HEALTH: 'STATUTORY_HEALTH',
  CARE: 'STATUTORY_CARE',
  PENSION: 'STATUTORY_PENSION',
  UNEMPLOYMENT: 'STATUTORY_UNEMPLOYMENT',
};
