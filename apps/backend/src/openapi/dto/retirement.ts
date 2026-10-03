import { ApiExtraModels, ApiProperty, ApiPropertyOptional, getSchemaPath } from '@nestjs/swagger';

/**
 * Mirrors `libs/api-contract/src/lib/retirement.ts` (specs/037-altersvorsorge-retirement-planning/
 * contracts/retirement-api.md). Every monetary field is a canonical decimal string. Presentation-
 * layer mirror only — the service validates bodies with the strict whitelist of
 * `@vaultfolio/retirement` (unknown or inapplicable fields are rejected).
 */

const MONEY = {
  type: String,
  example: '1234.56',
  description: 'Canonical decimal string (EUR, up to 2 decimal places).',
};
const DATE = { type: String, example: '2026-04-01', description: 'YYYY-MM-DD.' };
const CONTRACT_TYPES = [
  'STATUTORY_PENSION',
  'DIRECT_INSURANCE',
  'PENSIONSKASSE',
  'DIREKTZUSAGE',
  'UNTERSTUETZUNGSKASSE',
  'PENSIONSFONDS',
  'CAPITAL_ACCOUNT',
  'RIESTER',
  'PRIVATE_PENSION_INSURANCE',
  'ALTERSVORSORGEDEPOT',
] as const;
const PILLARS = ['STATUTORY', 'OCCUPATIONAL', 'PRIVATE'] as const;
const ORIGINS = ['IMPORTED', 'MANUAL'] as const;
const STATUSES = ['ACTIVE', 'PAID_UP', 'IN_PAYOUT'] as const;
const SCENARIOS = ['0', '3', '6', '9'] as const;

// ------------------------------------------------------------------ figures

export class RetirementStatutoryFiguresDto {
  @ApiPropertyOptional(DATE) dataPeriodFrom?: string;
  @ApiPropertyOptional(DATE) dataPeriodTo?: string;
  @ApiPropertyOptional(MONEY) fullDisabilityMonthly?: string;
  @ApiPropertyOptional(MONEY) accruedMonthly?: string;
  @ApiProperty(MONEY) projectedMonthly!: string;
  @ApiPropertyOptional(MONEY) projectedAt1Pct?: string;
  @ApiPropertyOptional(MONEY) projectedAt2Pct?: string;
  @ApiPropertyOptional({ type: String, example: '28.5000', description: 'Up to 4 decimals.' })
  earningsPoints?: string;
  @ApiPropertyOptional(MONEY) currentPensionValue?: string;
  @ApiPropertyOptional(MONEY) contributionsOwn?: string;
  @ApiPropertyOptional(MONEY) contributionsEmployer?: string;
  @ApiPropertyOptional(MONEY) contributionsPublic?: string;
}

export class RetirementScenarioMonthlyDto {
  @ApiPropertyOptional(MONEY) '0'?: string;
  @ApiPropertyOptional(MONEY) '3'?: string;
  @ApiPropertyOptional(MONEY) '6'?: string;
  @ApiPropertyOptional(MONEY) '9'?: string;
}

export class RetirementPensionFiguresDto {
  @ApiPropertyOptional(MONEY) guaranteedMonthly?: string;
  @ApiPropertyOptional(MONEY) expectedMonthly?: string;
  @ApiPropertyOptional(MONEY) guaranteedCapital?: string;
  @ApiPropertyOptional({ type: RetirementScenarioMonthlyDto })
  scenarioMonthly?: RetirementScenarioMonthlyDto;
  @ApiPropertyOptional(MONEY) currentValue?: string;
  @ApiPropertyOptional(MONEY) contributionsPaid?: string;
  @ApiPropertyOptional(MONEY) contributionsMain?: string;
  @ApiPropertyOptional(MONEY) contributionsExtra?: string;
  @ApiPropertyOptional(MONEY) surrenderValue?: string;
  @ApiPropertyOptional(MONEY) deathBenefit?: string;
  @ApiPropertyOptional({ type: Number, example: 10 }) guaranteePeriodYears?: number;
  @ApiPropertyOptional(MONEY) capitalPayout?: string;
  @ApiPropertyOptional({ ...MONEY, description: 'Manual records only (supplement otherwise).' })
  contributionMonthly?: string;
  @ApiPropertyOptional(MONEY) employerContributionMonthly?: string;
  @ApiPropertyOptional(MONEY) subsidiesYearly?: string;
}

export class RetirementCapitalAccountFiguresDto {
  @ApiPropertyOptional(MONEY) openingBalance?: string;
  @ApiProperty(MONEY) accountBalance!: string;
  @ApiPropertyOptional({
    type: String,
    example: '1.2500',
    description: 'Percent, up to 4 decimals.',
  })
  guaranteedInterestRate?: string;
  @ApiPropertyOptional(MONEY) interestCredit?: string;
  @ApiPropertyOptional(MONEY) annualContribution?: string;
  @ApiPropertyOptional(MONEY) finalBonus?: string;
  @ApiPropertyOptional(MONEY) expectedMonthly?: string;
  @ApiPropertyOptional(MONEY) contributionMonthly?: string;
  @ApiPropertyOptional(MONEY) employerContributionMonthly?: string;
}

export class RetirementDepotFiguresDto {
  @ApiPropertyOptional(MONEY) currentValue?: string;
  @ApiPropertyOptional(MONEY) expectedMonthly?: string;
  @ApiPropertyOptional(MONEY) contributionMonthly?: string;
}

const FIGURES_SCHEMA = {
  description: 'Figures of the contract type (strict per-type whitelist).',
  oneOf: [
    RetirementStatutoryFiguresDto,
    RetirementPensionFiguresDto,
    RetirementCapitalAccountFiguresDto,
    RetirementDepotFiguresDto,
  ].map((dto) => ({ $ref: getSchemaPath(dto) })),
};

// ------------------------------------------------------------------ supplement, import

export class RetirementSupplementDto {
  @ApiPropertyOptional(MONEY) contributionMonthly?: string;
  @ApiPropertyOptional(MONEY) employerContributionMonthly?: string;
  @ApiPropertyOptional(MONEY) subsidiesYearly?: string;
  @ApiPropertyOptional(MONEY) expectedMonthly?: string;
  @ApiPropertyOptional({ enum: SCENARIOS }) expectedScenario?: (typeof SCENARIOS)[number];
}

export class RetirementSupplementPatchDto extends RetirementSupplementDto {
  @ApiPropertyOptional({ enum: STATUSES }) status?: (typeof STATUSES)[number];
}

export class RetirementImportInfoDto {
  @ApiProperty({ example: 'private-statement' }) parserId!: string;
  @ApiProperty({ example: '1.0.0' }) parserVersion!: string;
  @ApiProperty({ description: 'The text came from on-device recognition (double-check marker).' })
  ocrRead!: boolean;
}

// ------------------------------------------------------------------ bodies

@ApiExtraModels(
  RetirementStatutoryFiguresDto,
  RetirementPensionFiguresDto,
  RetirementCapitalAccountFiguresDto,
  RetirementDepotFiguresDto,
)
export class RetirementManualRecordInputDto {
  @ApiProperty({ enum: CONTRACT_TYPES }) contractType!: (typeof CONTRACT_TYPES)[number];
  @ApiProperty({ enum: STATUSES }) status!: (typeof STATUSES)[number];
  @ApiPropertyOptional({ maxLength: 80, description: 'Required for occupational and private.' })
  providerLabel?: string;
  @ApiProperty({ ...DATE, description: 'Statement date, not in the future.' })
  statementDate!: string;
  @ApiPropertyOptional(DATE) payoutStart?: string;
  @ApiPropertyOptional({
    maxLength: 40,
    description: 'Insurance or contract number; stored encrypted.',
  })
  identifier?: string;
  @ApiProperty(FIGURES_SCHEMA) figures!: Record<string, unknown>;
}

export class RetirementRecordInputDto extends RetirementManualRecordInputDto {
  @ApiProperty({ enum: ORIGINS }) origin!: (typeof ORIGINS)[number];
  @ApiPropertyOptional({ type: RetirementSupplementDto, description: 'IMPORTED only.' })
  supplement?: RetirementSupplementDto;
  @ApiPropertyOptional({ type: RetirementImportInfoDto, description: 'Required iff IMPORTED.' })
  import?: RetirementImportInfoDto;
  @ApiPropertyOptional({
    description: 'IMPORTED only: id of the record of the same type this one replaces.',
  })
  replaces?: string;
}

// ------------------------------------------------------------------ responses

export class RetirementRecordDto {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: PILLARS }) pillar!: (typeof PILLARS)[number];
  @ApiProperty({ enum: CONTRACT_TYPES }) contractType!: (typeof CONTRACT_TYPES)[number];
  @ApiProperty({ enum: ORIGINS }) origin!: (typeof ORIGINS)[number];
  @ApiProperty({ enum: STATUSES }) status!: (typeof STATUSES)[number];
  @ApiProperty({ type: String, nullable: true }) providerLabel!: string | null;
  @ApiProperty(DATE) statementDate!: string;
  @ApiProperty({ ...DATE, nullable: true }) payoutStart!: string | null;
  @ApiProperty({ type: String, nullable: true }) identifier!: string | null;
  @ApiProperty(FIGURES_SCHEMA) figures!: Record<string, unknown>;
  @ApiProperty({ type: RetirementSupplementDto, nullable: true })
  supplement!: RetirementSupplementDto | null;
  @ApiProperty({ type: RetirementImportInfoDto, nullable: true })
  import!: RetirementImportInfoDto | null;
  @ApiProperty() createdAt!: string;
  @ApiProperty() updatedAt!: string;
}
