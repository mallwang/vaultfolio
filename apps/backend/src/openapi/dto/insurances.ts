import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Mirrors `libs/api-contract/src/lib/insurances.ts` (specs/039-insurances-management/contracts/
 * insurances-api.md). Amounts are canonical decimal strings with two fractional digits.
 * Presentation-layer mirror only — the service validates bodies with the strict whitelist of
 * `@vaultfolio/insurances` (unknown fields are rejected).
 */

const TYPE_IDS = [
  'STATUTORY_HEALTH',
  'STATUTORY_CARE',
  'STATUTORY_PENSION',
  'STATUTORY_UNEMPLOYMENT',
  'PRIVATE_HEALTH',
  'SUPPLEMENTARY_HEALTH',
  'DENTAL_SUPPLEMENT',
  'TRAVEL_HEALTH',
  'LONG_TERM_CARE',
  'DISABILITY',
  'TERM_LIFE',
  'ACCIDENT',
  'PRIVATE_LIABILITY',
  'PET_LIABILITY',
  'PROPERTY_OWNER_LIABILITY',
  'HOUSEHOLD',
  'BUILDING',
  'NATURAL_HAZARD',
  'GLASS',
  'CAR',
  'BICYCLE',
  'LEGAL_PROTECTION',
  'OTHER',
] as const;
const STATUSES = ['ACTIVE', 'CANCELLED', 'ENDED'] as const;
const INTERVALS = ['MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'YEARLY'] as const;
const EMPLOYMENTS = ['EMPLOYED', 'SELF_EMPLOYED', 'CIVIL_SERVANT', 'OTHER'] as const;
const SOCIAL_KINDS = ['HEALTH', 'CARE', 'PENSION', 'UNEMPLOYMENT'] as const;
const REQUIREMENTS = [
  'HEALTH',
  'LIABILITY',
  'HOUSEHOLD',
  'DISABILITY',
  'BUILDING',
  'NATURAL_HAZARD',
  'CAR',
  'PET_LIABILITY',
  'TRAVEL_HEALTH',
  'RISK_LIFE',
  'LEGAL',
  'PROPERTY_OWNER_LIABILITY',
] as const;

export class InsurancePeriodDto {
  @ApiProperty({ type: Number, minimum: 0, maximum: 60 }) value!: number;
  @ApiProperty({ enum: ['WEEKS', 'MONTHS'] }) unit!: 'WEEKS' | 'MONTHS';
}

export class InsuranceFixedDateDto {
  @ApiProperty({ type: Number, minimum: 1, maximum: 31 }) day!: number;
  @ApiProperty({ type: Number, minimum: 1, maximum: 12 }) month!: number;
}

export class InsuranceCancellationDto {
  @ApiPropertyOptional({ type: InsurancePeriodDto }) period?: InsurancePeriodDto;
  @ApiProperty({ type: Boolean }) autoRenew!: boolean;
  @ApiPropertyOptional({ type: Number, minimum: 1, maximum: 60 }) renewalMonths?: number;
  @ApiPropertyOptional({ type: Number, minimum: 1, maximum: 600 }) minimumTermMonths?: number;
  @ApiPropertyOptional({ type: InsuranceFixedDateDto }) fixedDate?: InsuranceFixedDateDto;
}

export class InsuranceContractDetailsDto {
  @ApiPropertyOptional({ type: String, example: '5000000.00' }) coverageSum?: string;
  @ApiPropertyOptional({ type: String, example: '150.00' }) deductible?: string;
  @ApiPropertyOptional({ type: String, example: '1500.00' }) insuredMonthlyBenefit?: string;
  @ApiPropertyOptional({ type: String, example: '60000.00' }) insuredSum?: string;
  @ApiPropertyOptional({ type: String, maxLength: 30 }) licensePlate?: string;
  @ApiPropertyOptional({ type: String, maxLength: 30 }) noClaimsClass?: string;
}

export class InsuranceContractInputDto {
  @ApiProperty({ enum: TYPE_IDS }) type!: (typeof TYPE_IDS)[number];
  @ApiPropertyOptional({
    enum: TYPE_IDS,
    isArray: true,
    maxItems: 10,
    description: 'Combination products: further catalog types this contract covers.',
  })
  alsoCovers?: (typeof TYPE_IDS)[number][];
  @ApiProperty({ type: String, minLength: 1, maxLength: 100 }) name!: string;
  @ApiPropertyOptional({ type: String, maxLength: 100 }) insurer?: string;
  @ApiPropertyOptional({ type: String, maxLength: 50 }) contractNumber?: string;
  @ApiProperty({ enum: STATUSES }) status!: (typeof STATUSES)[number];
  @ApiProperty({ type: String, example: '2025-01-01', description: 'YYYY-MM-DD.' })
  startDate!: string;
  @ApiPropertyOptional({ type: String, description: 'YYYY-MM-DD, not before startDate.' })
  endDate?: string;
  @ApiProperty({
    type: String,
    example: '96.00',
    description: 'Decimal string, at most two digits.',
  })
  premium!: string;
  @ApiProperty({ enum: INTERVALS }) interval!: (typeof INTERVALS)[number];
  @ApiPropertyOptional({
    type: Number,
    minimum: 1,
    maximum: 12,
    description: 'Only for non-monthly intervals.',
  })
  paymentMonth?: number;
  @ApiProperty({ type: InsuranceCancellationDto }) cancellation!: InsuranceCancellationDto;
  @ApiProperty({ type: Boolean }) reminderEnabled!: boolean;
  @ApiPropertyOptional({ type: InsuranceContractDetailsDto }) details?: InsuranceContractDetailsDto;
  @ApiPropertyOptional({ type: String, maxLength: 500 }) note?: string;
}

export class InsuranceContractDto extends InsuranceContractInputDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ format: 'date-time' }) updatedAt!: string;
}

export class InsuranceProfileDto {
  @ApiProperty({ type: Boolean }) ownsProperty!: boolean;
  @ApiProperty({ type: Boolean }) ownsCar!: boolean;
  @ApiProperty({ type: Boolean }) hasChildren!: boolean;
  @ApiProperty({ type: Boolean }) hasPets!: boolean;
  @ApiProperty({ type: Boolean }) travelsAbroad!: boolean;
  @ApiProperty({ enum: EMPLOYMENTS }) employment!: (typeof EMPLOYMENTS)[number];
}

export class InsuranceRemindersDto {
  @ApiProperty({ type: Boolean }) enabled!: boolean;
  @ApiProperty({ type: Number, minimum: 7, maximum: 120, example: 30 }) leadDays!: number;
}

export class InsuranceSettingsDto {
  @ApiProperty({ type: InsuranceProfileDto }) profile!: InsuranceProfileDto;
  @ApiProperty({ type: InsuranceRemindersDto }) reminders!: InsuranceRemindersDto;
  @ApiProperty({ enum: REQUIREMENTS, isArray: true, maxItems: 50 })
  dismissedRequirements!: (typeof REQUIREMENTS)[number][];
  @ApiProperty({ type: Boolean }) includeSocial!: boolean;
}

export class InsuranceLinkedSocialLineDto {
  @ApiProperty({ enum: SOCIAL_KINDS }) kind!: (typeof SOCIAL_KINDS)[number];
  @ApiProperty({ type: String, example: '612.00' }) monthly!: string;
  @ApiProperty({ type: String, example: '2026-09', description: 'YYYY-MM of the payslip.' })
  period!: string;
}

export class InsurancesDataDto {
  @ApiProperty({ type: [InsuranceContractDto] }) contracts!: InsuranceContractDto[];
  @ApiProperty({
    type: [InsuranceLinkedSocialLineDto],
    description: 'Derived read-only from the caller’s Earnings data; empty without access or data.',
  })
  linkedSocial!: InsuranceLinkedSocialLineDto[];
  @ApiProperty({ type: InsuranceSettingsDto }) settings!: InsuranceSettingsDto;
  @ApiProperty({ type: String, example: '2026-10-05', description: 'Server date YYYY-MM-DD.' })
  today!: string;
}
