import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Param,
  Post,
  Put,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBody, ApiExtraModels, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import type {
  CreateHoldingRequest,
  HoldingNotFoundErrorResponse,
  HoldingResponse,
  HoldingValidationErrorResponse,
  UpdateHoldingRequest,
} from '@vaultfolio/api-contract';
import { HoldingsAvailableGuard } from './holdings-available.guard';
import { HoldingsService } from './holdings.service';
import { holdingToResponse } from './holdings.mapper';
import type { FieldError } from '@vaultfolio/domain-holdings';
import { CurrentUser } from '../auth/current-user.decorator';
import type { RequestUser } from '../auth/current-user.decorator';
import { RequiresDomain } from '../auth/domain.decorator';
import { ApiVaultfolioSessionAuth } from '../openapi/api-vaultfolio-auth.decorator';
import { ApiDomainMaintenanceResponse } from '../openapi/api-domain-maintenance.decorator';
import {
  CreateCryptoHoldingRequestDto,
  CreateDepositMoneyHoldingRequestDto,
  CreateEtfHoldingRequestDto,
  CreatePreciousMetalHoldingRequestDto,
  CreateShareHoldingRequestDto,
  HoldingNotFoundErrorResponseDto,
  HoldingResponseDto,
  HoldingValidationErrorResponseDto,
  HoldingsUnavailableResponseDto,
  UpdateCryptoHoldingRequestDto,
  UpdateDepositMoneyHoldingRequestDto,
  UpdateEtfHoldingRequestDto,
  UpdatePreciousMetalHoldingRequestDto,
  UpdateShareHoldingRequestDto,
  createHoldingRequestSchema,
  updateHoldingRequestSchema,
} from '../openapi/dto/holdings';

function validationErrorBody(errors: FieldError[]): HoldingValidationErrorResponse {
  return { message: 'One or more fields are invalid.', errors };
}

const NOT_FOUND_BODY: HoldingNotFoundErrorResponse = {
  error: 'HOLDING_NOT_FOUND',
  message: 'This holding no longer exists.',
};

/** REST surface for `/holdings`, per contracts/holdings-api.md (Principle II). `@RequiresDomain('holdings')` — `AuthGuard`/`DomainGuard` run globally (AuthModule) — mirrors the frontend's `domainGuard('holdings')`. */
@ApiTags('holdings')
@ApiVaultfolioSessionAuth()
@ApiDomainMaintenanceResponse()
@Controller('holdings')
@RequiresDomain('holdings')
@UseGuards(HoldingsAvailableGuard)
@ApiResponse({
  status: 503,
  description: 'Holdings data is unavailable (no usable encryption key).',
  type: HoldingsUnavailableResponseDto,
})
export class HoldingsController {
  constructor(private readonly holdingsService: HoldingsService) {}

  @Get()
  @ApiOperation({ summary: "List the caller's holdings." })
  @ApiResponse({ status: 200, type: [HoldingResponseDto] })
  list(@CurrentUser() user: RequestUser): HoldingResponse[] {
    const holdings = this.holdingsService.findAll(user.id);
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
  create(
    @Body() body: CreateHoldingRequest,
    @CurrentUser() user: RequestUser,
    @Res({ passthrough: true }) res: Response,
  ): HoldingResponse | HoldingValidationErrorResponse {
    const result = this.holdingsService.create(body, user.id);

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
  update(
    @Param('id') id: string,
    @Body() body: UpdateHoldingRequest,
    @CurrentUser() user: RequestUser,
    @Res({ passthrough: true }) res: Response,
  ): HoldingResponse | HoldingValidationErrorResponse | HoldingNotFoundErrorResponse {
    const result = this.holdingsService.update(id, body, user.id);

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
  delete(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
    @Res({ passthrough: true }) res: Response,
  ): HoldingNotFoundErrorResponse | undefined {
    const deleted = this.holdingsService.delete(id, user.id);

    if (!deleted) {
      res.status(HttpStatus.NOT_FOUND);
      return NOT_FOUND_BODY;
    }

    res.status(HttpStatus.NO_CONTENT);
    return undefined;
  }
}
