import { ApiProperty, ApiPropertyOptional, getSchemaPath } from '@nestjs/swagger';

/** Mirrors `libs/api-contract/src/lib/holdings.ts`'s `AssetType`. */
export const METALS = ['XAU', 'XAG', 'XPT', 'XPD'] as const;
export const UNITS = ['G', 'OZT'] as const;

export const ASSET_TYPES = ['ETF', 'SHARE', 'PRECIOUS_METAL', 'CRYPTO', 'DEPOSIT_MONEY'] as const;

/**
 * Mirrors `libs/api-contract/src/lib/holdings.ts`'s `HoldingResponse` — the
 * full shape returned by GET/POST/PUT, same shape as a list item. All
 * monetary/quantity fields are decimal strings, never JSON numbers
 * (constitution's Money/decimal handling clause).
 */
export class HoldingResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: ASSET_TYPES })
  assetType!: (typeof ASSET_TYPES)[number];

  @ApiProperty({ description: 'Freeform label for who/what manages this holding.' })
  management!: string;

  @ApiPropertyOptional({ nullable: true, example: '10', description: 'Decimal string.' })
  quantity!: string | null;

  @ApiPropertyOptional({ nullable: true, example: '123.45', description: 'Decimal string.' })
  purchasePrice!: string | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 500 })
  note!: string | null;

  @ApiPropertyOptional({ nullable: true })
  isin!: string | null;

  @ApiPropertyOptional({ nullable: true })
  name!: string | null;

  @ApiPropertyOptional({ nullable: true, enum: METALS })
  metal!: (typeof METALS)[number] | null;

  @ApiPropertyOptional({ nullable: true, description: 'Crypto catalogue id (CoinGecko).' })
  coinId!: string | null;

  @ApiPropertyOptional({ nullable: true, enum: UNITS })
  unit!: (typeof UNITS)[number] | null;

  @ApiPropertyOptional({ nullable: true, example: '1000.00', description: 'Decimal string.' })
  currentValue!: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}

export class CreateEtfHoldingRequestDto {
  @ApiProperty({ enum: ['ETF'] })
  assetType!: 'ETF';

  @ApiProperty()
  management!: string;

  @ApiPropertyOptional({ maxLength: 500 })
  note?: string;

  @ApiProperty()
  isin!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ example: '10' })
  quantity!: string;

  @ApiProperty({ example: '123.45' })
  purchasePrice!: string;
}

export class CreateShareHoldingRequestDto {
  @ApiProperty({ enum: ['SHARE'] })
  assetType!: 'SHARE';

  @ApiProperty()
  management!: string;

  @ApiPropertyOptional({ maxLength: 500 })
  note?: string;

  @ApiProperty()
  isin!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ example: '10' })
  quantity!: string;

  @ApiProperty({ example: '123.45' })
  purchasePrice!: string;
}

export class CreatePreciousMetalHoldingRequestDto {
  @ApiProperty({ enum: ['PRECIOUS_METAL'] })
  assetType!: 'PRECIOUS_METAL';

  @ApiProperty()
  management!: string;

  @ApiPropertyOptional({ maxLength: 500 })
  note?: string;

  @ApiProperty({ enum: METALS })
  metal!: (typeof METALS)[number];

  @ApiProperty({ example: '15.5' })
  quantity!: string;

  @ApiProperty({ enum: UNITS })
  unit!: (typeof UNITS)[number];

  @ApiProperty({ example: '93.24', description: 'Purchase price per unit.' })
  purchasePrice!: string;
}

export class CreateCryptoHoldingRequestDto {
  @ApiProperty({ enum: ['CRYPTO'] })
  assetType!: 'CRYPTO';

  @ApiProperty()
  management!: string;

  @ApiPropertyOptional({ maxLength: 500 })
  note?: string;

  @ApiProperty({ description: 'Crypto catalogue id (CoinGecko).' })
  coinId!: string;

  @ApiProperty({ example: '0.5', description: 'At most 8 decimals.' })
  quantity!: string;

  @ApiProperty({ example: '30000.00' })
  purchasePrice!: string;
}

export class CreateDepositMoneyHoldingRequestDto {
  @ApiProperty({ enum: ['DEPOSIT_MONEY'] })
  assetType!: 'DEPOSIT_MONEY';

  @ApiProperty()
  management!: string;

  @ApiPropertyOptional({ maxLength: 500 })
  note?: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ example: '5000.00' })
  currentValue!: string;
}

/**
 * `POST /holdings` request body — shape depends on `assetType`
 * (FR-001–FR-007). Applied via `@ApiExtraModels(...)` + `@ApiBody({ schema })`
 * on the controller method, since this schema documents a `oneOf` union
 * `@nestjs/swagger` can't infer directly from a TS union type.
 */
export const createHoldingRequestSchema = {
  oneOf: [
    CreateEtfHoldingRequestDto,
    CreateShareHoldingRequestDto,
    CreatePreciousMetalHoldingRequestDto,
    CreateCryptoHoldingRequestDto,
    CreateDepositMoneyHoldingRequestDto,
  ].map((dto) => ({ $ref: getSchemaPath(dto) })),
};

export class UpdateEtfHoldingRequestDto extends CreateEtfHoldingRequestDto {}
export class UpdateShareHoldingRequestDto extends CreateShareHoldingRequestDto {}
export class UpdatePreciousMetalHoldingRequestDto extends CreatePreciousMetalHoldingRequestDto {}
export class UpdateCryptoHoldingRequestDto extends CreateCryptoHoldingRequestDto {}
export class UpdateDepositMoneyHoldingRequestDto extends CreateDepositMoneyHoldingRequestDto {}

/**
 * `PUT /holdings/:id` request body — same shape as the matching `POST` body,
 * without `assetType` (immutable after creation, FR-008).
 */
export const updateHoldingRequestSchema = {
  oneOf: [
    UpdateEtfHoldingRequestDto,
    UpdateShareHoldingRequestDto,
    UpdatePreciousMetalHoldingRequestDto,
    UpdateCryptoHoldingRequestDto,
    UpdateDepositMoneyHoldingRequestDto,
  ].map((dto) => ({ $ref: getSchemaPath(dto) })),
};

/** Mirrors `libs/api-contract/src/lib/holdings.ts`'s `HoldingValidationErrorResponse`. */
export class HoldingValidationErrorResponseDto {
  @ApiProperty()
  message!: string;

  @ApiProperty({
    type: 'array',
    items: {
      type: 'object',
      required: ['field', 'code'],
      properties: {
        field: { type: 'string' },
        code: {
          type: 'string',
          description:
            'REQUIRED, ISIN_INVALID, ISIN_NOT_ALLOWED, METAL_UNKNOWN, COIN_UNKNOWN, UNIT_INVALID, QUANTITY_NOT_POSITIVE, QUANTITY_DECIMALS, NOTE_TOO_LONG, DECIMAL_INVALID, FIELD_NOT_ALLOWED',
        },
      },
    },
  })
  errors!: { field: string; code: string }[];
}

/** 503 body returned while the holdings key is unavailable. */
export class HoldingsUnavailableResponseDto {
  @ApiProperty({ enum: ['HOLDINGS_UNAVAILABLE'] })
  error!: 'HOLDINGS_UNAVAILABLE';

  @ApiProperty()
  message!: string;
}

/** Mirrors `libs/api-contract/src/lib/holdings.ts`'s `HoldingNotFoundErrorResponse`. */
export class HoldingNotFoundErrorResponseDto {
  @ApiProperty({ enum: ['HOLDING_NOT_FOUND'] })
  error!: 'HOLDING_NOT_FOUND';

  @ApiProperty()
  message!: string;
}
