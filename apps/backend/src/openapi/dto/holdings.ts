import { ApiProperty, ApiPropertyOptional, getSchemaPath } from '@nestjs/swagger';

/** Mirrors `libs/api-contract/src/lib/holdings.ts`'s `AssetType`. */
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

  @ApiPropertyOptional({ nullable: true, format: 'date' })
  purchaseDate!: string | null;

  @ApiPropertyOptional({ nullable: true })
  isin!: string | null;

  @ApiPropertyOptional({ nullable: true })
  name!: string | null;

  @ApiPropertyOptional({ nullable: true, example: '15.5', description: 'Decimal string.' })
  weightGrams!: string | null;

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

  @ApiProperty()
  isin!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ example: '10' })
  quantity!: string;

  @ApiProperty({ example: '123.45' })
  purchasePrice!: string;

  @ApiPropertyOptional({ format: 'date', description: 'Omit entirely, not "".' })
  purchaseDate?: string;
}

export class CreatePreciousMetalHoldingRequestDto {
  @ApiProperty({ enum: ['PRECIOUS_METAL'] })
  assetType!: 'PRECIOUS_METAL';

  @ApiProperty()
  management!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ example: '15.5' })
  weightGrams!: string;

  @ApiPropertyOptional({ example: '1000.00', description: 'Used only by the distribution view.' })
  currentValue?: string;
}

export class CreateCryptoHoldingRequestDto {
  @ApiProperty({ enum: ['CRYPTO'] })
  assetType!: 'CRYPTO';

  @ApiProperty()
  management!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ example: '0.5' })
  quantity!: string;

  @ApiProperty({ example: '30000.00' })
  purchasePrice!: string;

  @ApiPropertyOptional({ format: 'date', description: 'Omit entirely, not "".' })
  purchaseDate?: string;
}

export class CreateDepositMoneyHoldingRequestDto {
  @ApiProperty({ enum: ['DEPOSIT_MONEY'] })
  assetType!: 'DEPOSIT_MONEY';

  @ApiProperty()
  management!: string;

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

/** Mirrors `libs/api-contract/src/lib/holdings.ts`'s `HoldingNotFoundErrorResponse`. */
export class HoldingNotFoundErrorResponseDto {
  @ApiProperty({ enum: ['HOLDING_NOT_FOUND'] })
  error!: 'HOLDING_NOT_FOUND';

  @ApiProperty()
  message!: string;
}
