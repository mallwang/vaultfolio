import { Body, Controller, Delete, Get, HttpStatus, Param, Post, Put, Res } from '@nestjs/common';
import { ApiBody, ApiExtraModels, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import type {
  CreateHoldingRequest,
  HoldingNotFoundErrorResponse,
  HoldingResponse,
  HoldingValidationErrorResponse,
  UpdateHoldingRequest,
} from '@vaultfolio/api-contract';
import { HoldingsService } from './holdings.service';
import { holdingToResponse } from './holdings.mapper';
import type { FieldError } from '@vaultfolio/domain-holdings';
import { CurrentUser } from '../auth/current-user.decorator';
import type { RequestUser } from '../auth/current-user.decorator';
import { RequiresDomain } from '../auth/domain.decorator';
import { ApiVaultfolioSessionAuth } from '../openapi/api-vaultfolio-auth.decorator';
import {
  CreateCryptoHoldingRequestDto,
  CreateDepositMoneyHoldingRequestDto,
  CreateEtfHoldingRequestDto,
  CreatePreciousMetalHoldingRequestDto,
  CreateShareHoldingRequestDto,
  HoldingNotFoundErrorResponseDto,
  HoldingResponseDto,
  HoldingValidationErrorResponseDto,
  UpdateCryptoHoldingRequestDto,
  UpdateDepositMoneyHoldingRequestDto,
  UpdateEtfHoldingRequestDto,
  UpdatePreciousMetalHoldingRequestDto,
  UpdateShareHoldingRequestDto,
  createHoldingRequestSchema,
  updateHoldingRequestSchema,
} from '../openapi/dto/holdings';

function validationErrorBody(fieldErrors: FieldError[]): HoldingValidationErrorResponse {
  return {
    error: 'VALIDATION_FAILED',
    message: 'One or more fields are invalid.',
    fieldErrors,
  };
}

const NOT_FOUND_BODY: HoldingNotFoundErrorResponse = {
  error: 'HOLDING_NOT_FOUND',
  message: 'This holding no longer exists.',
};

/** REST surface for `/holdings`, per contracts/holdings-api.md (Principle II). `@RequiresDomain('holdings')` — `AuthGuard`/`DomainGuard` run globally (AuthModule) — mirrors the frontend's `domainGuard('holdings')`. */
@ApiTags('holdings')
@ApiVaultfolioSessionAuth()
@Controller('holdings')
@RequiresDomain('holdings')
export class HoldingsController {
  constructor(private readonly holdingsService: HoldingsService) {}

  @Get()
  @ApiOperation({ summary: "List the caller's holdings." })
  @ApiResponse({ status: 200, type: [HoldingResponseDto] })
  async list(@CurrentUser() user: RequestUser): Promise<HoldingResponse[]> {
    const holdings = await this.holdingsService.findAll(user.id);
    return holdings.map(holdingToResponse);
  }

  @Post()
  @ApiOperation({ summary: 'Create a holding — request shape depends on `assetType`.' })
  @ApiExtraModels(
    CreateEtfHoldingRequestDto,
    CreateShareHoldingRequestDto,
    CreatePreciousMetalHoldingRequestDto,
    CreateCryptoHoldingRequestDto,
    CreateDepositMoneyHoldingRequestDto,
  )
  @ApiBody({ schema: createHoldingRequestSchema })
  @ApiResponse({ status: 201, type: HoldingResponseDto })
  @ApiResponse({
    status: 400,
    description: 'One or more fields are invalid.',
    type: HoldingValidationErrorResponseDto,
  })
  async create(
    @Body() body: CreateHoldingRequest,
    @CurrentUser() user: RequestUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<HoldingResponse | HoldingValidationErrorResponse> {
    const result = await this.holdingsService.create(body, user.id);

    if (result.kind === 'invalid') {
      res.status(HttpStatus.BAD_REQUEST);
      return validationErrorBody(result.fieldErrors);
    }

    res.status(result.kind === 'created' ? HttpStatus.CREATED : HttpStatus.OK);
    return holdingToResponse(result.holding);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a holding — same shape as create, without `assetType`.' })
  @ApiExtraModels(
    UpdateEtfHoldingRequestDto,
    UpdateShareHoldingRequestDto,
    UpdatePreciousMetalHoldingRequestDto,
    UpdateCryptoHoldingRequestDto,
    UpdateDepositMoneyHoldingRequestDto,
  )
  @ApiBody({ schema: updateHoldingRequestSchema })
  @ApiResponse({ status: 200, type: HoldingResponseDto })
  @ApiResponse({
    status: 400,
    description: 'One or more fields are invalid.',
    type: HoldingValidationErrorResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'This holding no longer exists.',
    type: HoldingNotFoundErrorResponseDto,
  })
  async update(
    @Param('id') id: string,
    @Body() body: UpdateHoldingRequest,
    @CurrentUser() user: RequestUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<HoldingResponse | HoldingValidationErrorResponse | HoldingNotFoundErrorResponse> {
    const result = await this.holdingsService.update(id, body, user.id);

    if (result.kind === 'not_found') {
      res.status(HttpStatus.NOT_FOUND);
      return NOT_FOUND_BODY;
    }
    if (result.kind === 'invalid') {
      res.status(HttpStatus.BAD_REQUEST);
      return validationErrorBody(result.fieldErrors);
    }

    res.status(HttpStatus.OK);
    return holdingToResponse(result.holding);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a holding.' })
  @ApiResponse({ status: 204, description: 'Deleted.' })
  @ApiResponse({
    status: 404,
    description: 'This holding no longer exists.',
    type: HoldingNotFoundErrorResponseDto,
  })
  async delete(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<HoldingNotFoundErrorResponse | undefined> {
    const deleted = await this.holdingsService.delete(id, user.id);

    if (!deleted) {
      res.status(HttpStatus.NOT_FOUND);
      return NOT_FOUND_BODY;
    }

    res.status(HttpStatus.NO_CONTENT);
    return undefined;
  }
}
