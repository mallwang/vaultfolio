import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Mirrors `libs/api-contract/src/lib/wealth.ts` (specs/038-networth-tracking/contracts/
 * wealth-api.md). Amounts are canonical decimal strings with two fractional digits. Presentation-
 * layer mirror only — the service validates bodies with the strict whitelist of
 * `@vaultfolio/wealth` (unknown fields are rejected).
 */

const STANDARD_CLASS_IDS = [
  'cash',
  'bankBalances',
  'preciousMetals',
  'securities',
  'crypto',
  'realEstate',
  'vehicles',
  'collectibles',
  'otherAsset',
  'mortgage',
  'loan',
  'otherDebt',
] as const;
const SIDES = ['ASSET', 'LIABILITY'] as const;
const BALANCE_GROUPS = [
  'LIQUID',
  'SECURITIES',
  'TANGIBLE',
  'OTHER_ASSET',
  'SHORT_TERM',
  'LONG_TERM',
  'OTHER_LIABILITY',
] as const;

export class WealthClassRefDto {
  @ApiPropertyOptional({
    enum: STANDARD_CLASS_IDS,
    description: 'A suggested class; valid only on its own side. Exactly one of standard/custom.',
  })
  standard?: (typeof STANDARD_CLASS_IDS)[number];

  @ApiPropertyOptional({
    type: String,
    maxLength: 50,
    example: 'Whisky',
    description: 'Free-text class, 1–50 characters. Exactly one of standard/custom.',
  })
  custom?: string;
}

export class WealthEntryDto {
  @ApiProperty({ enum: SIDES }) side!: (typeof SIDES)[number];
  @ApiProperty({ type: WealthClassRefDto }) class!: WealthClassRefDto;
  @ApiProperty({ type: String, maxLength: 100, example: 'Girokonto' }) name!: string;
  @ApiProperty({
    type: String,
    example: '12000.00',
    description: 'Decimal string, at most two fractional digits, 0 … 999999999999.99.',
  })
  amount!: string;
}

export class WealthSnapshotInputDto {
  @ApiProperty({
    type: String,
    example: '2026-09-30',
    description: 'YYYY-MM-DD, 1900-01-01 … today (one day tolerance); unique per owner.',
  })
  snapshotDate!: string;

  @ApiPropertyOptional({ type: String, maxLength: 500 }) note?: string;

  @ApiProperty({ type: [WealthEntryDto], minItems: 1, maxItems: 200 }) entries!: WealthEntryDto[];
}

export class WealthSnapshotDto extends WealthSnapshotInputDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ format: 'date-time' }) updatedAt!: string;
}

export class WealthClassGroupAssignmentDto {
  @ApiProperty({ enum: SIDES }) side!: (typeof SIDES)[number];
  @ApiProperty({ type: WealthClassRefDto }) class!: WealthClassRefDto;
  @ApiProperty({ enum: BALANCE_GROUPS, description: 'Must belong to the same side.' })
  group!: (typeof BALANCE_GROUPS)[number];
}

export class WealthSettingsDto {
  @ApiProperty({ type: [WealthClassGroupAssignmentDto] })
  classGroups!: WealthClassGroupAssignmentDto[];
}
