import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const ACCOUNT_CATEGORIES = [
  'GENERAL',
  'LEISURE',
  'SAVINGS',
  'DEPOT',
  'CREDIT_CARD',
  'OTHER',
] as const;
export const ACCOUNT_STATUSES = ['ACTIVE', 'DECOMMISSIONED'] as const;

/**
 * Mirrors `libs/api-contract/src/lib/account-overview.ts`'s
 * `AccountOverviewEntry` — the full shape returned by GET/POST/PUT, same
 * shape as a list item. No monetary values here (FR-012) — every field is
 * plain text.
 */
export class AccountOverviewEntryDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ enum: ACCOUNT_CATEGORIES })
  category!: (typeof ACCOUNT_CATEGORIES)[number];

  @ApiProperty({
    enum: ACCOUNT_STATUSES,
    description:
      'A decommissioned account stays listed, sorted after the active ones within its category.',
  })
  status!: (typeof ACCOUNT_STATUSES)[number];

  @ApiPropertyOptional({ nullable: true })
  provider!: string | null;

  @ApiPropertyOptional({ nullable: true })
  website!: string | null;

  @ApiPropertyOptional({ nullable: true })
  purpose!: string | null;

  @ApiPropertyOptional({ nullable: true })
  cardUsage!: string | null;

  @ApiPropertyOptional({ nullable: true })
  requiredMinimum!: string | null;

  @ApiPropertyOptional({ nullable: true })
  notes!: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Full card number as entered (CREDIT_CARD accounts only).',
  })
  cardNumber!: string | null;

  @ApiPropertyOptional({ nullable: true, example: '12/29', description: 'MM/YY.' })
  validUntil!: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}

/** Mirrors `libs/api-contract/src/lib/account-overview.ts`'s `CreateAccountOverviewEntryRequest`. */
export class CreateAccountOverviewEntryRequestDto {
  @ApiProperty()
  name!: string;

  @ApiPropertyOptional({ enum: ACCOUNT_CATEGORIES, description: "Omit to default to 'OTHER'." })
  category?: (typeof ACCOUNT_CATEGORIES)[number];

  @ApiPropertyOptional({ enum: ACCOUNT_STATUSES, description: "Omit to default to 'ACTIVE'." })
  status?: (typeof ACCOUNT_STATUSES)[number];

  @ApiPropertyOptional()
  provider?: string;

  @ApiPropertyOptional()
  website?: string;

  @ApiPropertyOptional()
  purpose?: string;

  @ApiPropertyOptional()
  cardUsage?: string;

  @ApiPropertyOptional()
  requiredMinimum?: string;

  @ApiPropertyOptional()
  notes?: string;

  @ApiPropertyOptional()
  cardNumber?: string;

  @ApiPropertyOptional({ example: '12/29' })
  validUntil?: string;
}

/**
 * `PUT /account-overview/accounts/:id` request body — every field optional;
 * an omitted field leaves its current stored value unchanged, an
 * empty-string field clears it (FR-006).
 */
export class UpdateAccountOverviewEntryRequestDto extends CreateAccountOverviewEntryRequestDto {}

/** Mirrors `libs/api-contract/src/lib/account-overview.ts`'s `AccountOverviewValidationErrorResponse`. */
export class AccountOverviewValidationErrorResponseDto {
  @ApiProperty({ enum: ['VALIDATION_FAILED'] })
  error!: 'VALIDATION_FAILED';

  @ApiProperty()
  message!: string;

  @ApiProperty({
    type: 'array',
    items: {
      type: 'object',
      properties: { field: { type: 'string' }, message: { type: 'string' } },
    },
  })
  fieldErrors!: { field: string; message: string }[];
}

/** Mirrors `libs/api-contract/src/lib/account-overview.ts`'s `AccountOverviewNotFoundErrorResponse`. */
export class AccountOverviewNotFoundErrorResponseDto {
  @ApiProperty({ enum: ['ACCOUNT_NOT_FOUND'] })
  error!: 'ACCOUNT_NOT_FOUND';

  @ApiProperty()
  message!: string;
}
