import type {
  Classification,
  DetailField,
  InsuranceGroup,
  InsuranceTypeId,
  Profile,
  RequirementId,
  SocialKind,
} from './model';

export interface InsuranceTypeDef {
  id: InsuranceTypeId;
  group: InsuranceGroup;
  classification: Classification;
  detailFields: readonly DetailField[];
  /** Statutory social insurance, entered monthly and linkable to Earnings. */
  social?: SocialKind;
  /** Types whose standard conditions often already include this cover (redundancy hint). */
  usuallyIncludedIn?: readonly InsuranceTypeId[];
}

const cov: DetailField[] = ['coverageSum', 'deductible'];

export const INSURANCE_TYPES: readonly InsuranceTypeDef[] = [
  {
    id: 'STATUTORY_HEALTH',
    group: 'PERSONS',
    classification: 'ESSENTIAL',
    detailFields: [],
    social: 'HEALTH',
  },
  {
    id: 'STATUTORY_CARE',
    group: 'PERSONS',
    classification: 'ESSENTIAL',
    detailFields: [],
    social: 'CARE',
  },
  {
    id: 'STATUTORY_PENSION',
    group: 'PERSONS',
    classification: 'ESSENTIAL',
    detailFields: [],
    social: 'PENSION',
  },
  {
    id: 'STATUTORY_UNEMPLOYMENT',
    group: 'PERSONS',
    classification: 'ESSENTIAL',
    detailFields: [],
    social: 'UNEMPLOYMENT',
  },
  {
    id: 'PRIVATE_HEALTH',
    group: 'PERSONS',
    classification: 'ESSENTIAL',
    detailFields: ['deductible'],
  },
  {
    id: 'SUPPLEMENTARY_HEALTH',
    group: 'PERSONS',
    classification: 'OPTIONAL',
    detailFields: ['deductible'],
  },
  {
    id: 'DENTAL_SUPPLEMENT',
    group: 'PERSONS',
    classification: 'OPTIONAL',
    detailFields: ['deductible'],
    usuallyIncludedIn: ['SUPPLEMENTARY_HEALTH'],
  },
  {
    id: 'TRAVEL_HEALTH',
    group: 'PERSONS',
    classification: 'RECOMMENDED',
    detailFields: ['deductible'],
  },
  {
    id: 'LONG_TERM_CARE',
    group: 'PERSONS',
    classification: 'SITUATIONAL',
    detailFields: ['insuredMonthlyBenefit'],
  },
  {
    id: 'DISABILITY',
    group: 'PERSONS',
    classification: 'ESSENTIAL',
    detailFields: ['insuredMonthlyBenefit'],
  },
  {
    id: 'TERM_LIFE',
    group: 'PERSONS',
    classification: 'RECOMMENDED',
    detailFields: ['coverageSum'],
  },
  { id: 'ACCIDENT', group: 'PERSONS', classification: 'OPTIONAL', detailFields: ['coverageSum'] },
  { id: 'PRIVATE_LIABILITY', group: 'LIABILITY', classification: 'ESSENTIAL', detailFields: cov },
  { id: 'PET_LIABILITY', group: 'LIABILITY', classification: 'SITUATIONAL', detailFields: cov },
  {
    id: 'PROPERTY_OWNER_LIABILITY',
    group: 'LIABILITY',
    classification: 'SITUATIONAL',
    detailFields: cov,
  },
  {
    id: 'HOUSEHOLD',
    group: 'PROPERTY',
    classification: 'ESSENTIAL',
    detailFields: ['insuredSum', 'deductible'],
  },
  {
    id: 'BUILDING',
    group: 'PROPERTY',
    classification: 'RECOMMENDED',
    detailFields: ['insuredSum', 'deductible'],
  },
  { id: 'NATURAL_HAZARD', group: 'PROPERTY', classification: 'RECOMMENDED', detailFields: cov },
  {
    id: 'GLASS',
    group: 'PROPERTY',
    classification: 'OPTIONAL',
    detailFields: ['deductible'],
    usuallyIncludedIn: ['HOUSEHOLD', 'BUILDING'],
  },
  {
    id: 'CAR',
    group: 'MOBILITY',
    classification: 'RECOMMENDED',
    detailFields: ['licensePlate', 'noClaimsClass', 'deductible', 'coverageSum'],
  },
  {
    id: 'BICYCLE',
    group: 'MOBILITY',
    classification: 'SITUATIONAL',
    detailFields: ['insuredSum', 'deductible'],
    usuallyIncludedIn: ['HOUSEHOLD'],
  },
  {
    id: 'LEGAL_PROTECTION',
    group: 'LEGAL',
    classification: 'SITUATIONAL',
    detailFields: ['deductible'],
  },
  { id: 'OTHER', group: 'OTHER', classification: 'OPTIONAL', detailFields: cov },
];

const BY_ID = new Map(INSURANCE_TYPES.map((t) => [t.id, t]));

export function typeDef(id: InsuranceTypeId): InsuranceTypeDef {
  const def = BY_ID.get(id);
  if (!def) throw new Error(`Unknown insurance type ${id}`);
  return def;
}

export function isInsuranceTypeId(value: unknown): value is InsuranceTypeId {
  return typeof value === 'string' && BY_ID.has(value as InsuranceTypeId);
}

export function isSocialType(id: InsuranceTypeId): boolean {
  return typeDef(id).social !== undefined;
}

export interface RequirementDef {
  id: RequirementId;
  classification: Classification;
  appliesWhen: (profile: Profile) => boolean;
  satisfiedBy: readonly InsuranceTypeId[];
}

export const REQUIREMENTS: readonly RequirementDef[] = [
  {
    id: 'HEALTH',
    classification: 'ESSENTIAL',
    appliesWhen: () => true,
    satisfiedBy: ['STATUTORY_HEALTH', 'PRIVATE_HEALTH'],
  },
  {
    id: 'LIABILITY',
    classification: 'ESSENTIAL',
    appliesWhen: () => true,
    satisfiedBy: ['PRIVATE_LIABILITY'],
  },
  {
    id: 'HOUSEHOLD',
    classification: 'ESSENTIAL',
    appliesWhen: () => true,
    satisfiedBy: ['HOUSEHOLD'],
  },
  {
    id: 'DISABILITY',
    classification: 'ESSENTIAL',
    appliesWhen: (p) => p.employment === 'EMPLOYED' || p.employment === 'SELF_EMPLOYED',
    satisfiedBy: ['DISABILITY'],
  },
  {
    id: 'BUILDING',
    classification: 'RECOMMENDED',
    appliesWhen: (p) => p.ownsProperty,
    satisfiedBy: ['BUILDING'],
  },
  {
    id: 'NATURAL_HAZARD',
    classification: 'RECOMMENDED',
    appliesWhen: (p) => p.ownsProperty,
    satisfiedBy: ['NATURAL_HAZARD'],
  },
  { id: 'CAR', classification: 'RECOMMENDED', appliesWhen: (p) => p.ownsCar, satisfiedBy: ['CAR'] },
  {
    id: 'TRAVEL_HEALTH',
    classification: 'RECOMMENDED',
    appliesWhen: (p) => p.travelsAbroad,
    satisfiedBy: ['TRAVEL_HEALTH'],
  },
  {
    id: 'RISK_LIFE',
    classification: 'RECOMMENDED',
    appliesWhen: (p) => p.hasChildren,
    satisfiedBy: ['TERM_LIFE'],
  },
  {
    id: 'PET_LIABILITY',
    classification: 'SITUATIONAL',
    appliesWhen: (p) => p.hasPets,
    satisfiedBy: ['PET_LIABILITY'],
  },
  {
    id: 'LEGAL',
    classification: 'SITUATIONAL',
    appliesWhen: () => true,
    satisfiedBy: ['LEGAL_PROTECTION'],
  },
  {
    id: 'PROPERTY_OWNER_LIABILITY',
    classification: 'SITUATIONAL',
    appliesWhen: (p) => p.ownsProperty,
    satisfiedBy: ['PROPERTY_OWNER_LIABILITY'],
  },
];

export function isRequirementId(value: unknown): value is RequirementId {
  return typeof value === 'string' && REQUIREMENTS.some((r) => r.id === value);
}
