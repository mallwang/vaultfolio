import { Body, Controller, Delete, Get, HttpStatus, Param, Post, Put, Res } from '@nestjs/common';
import type { Response } from 'express';
import type {
  CreateHoldingRequest,
  HoldingNotFoundErrorResponse,
  HoldingResponse,
  HoldingValidationErrorResponse,
  UpdateHoldingRequest,
} from 'api-contract';
import { HoldingsService } from './holdings.service';
import { holdingToResponse } from './holdings.mapper';
import type { FieldError } from 'domain-holdings';

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

/** REST surface for `/holdings`, per contracts/holdings-api.md (Principle II). */
@Controller('holdings')
export class HoldingsController {
  constructor(private readonly holdingsService: HoldingsService) {}

  @Get()
  async list(): Promise<HoldingResponse[]> {
    const holdings = await this.holdingsService.findAll();
    return holdings.map(holdingToResponse);
  }

  @Post()
  async create(
    @Body() body: CreateHoldingRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<HoldingResponse | HoldingValidationErrorResponse> {
    const result = await this.holdingsService.create(body);

    if (result.kind === 'invalid') {
      res.status(HttpStatus.BAD_REQUEST);
      return validationErrorBody(result.fieldErrors);
    }

    res.status(result.kind === 'created' ? HttpStatus.CREATED : HttpStatus.OK);
    return holdingToResponse(result.holding);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() body: UpdateHoldingRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<HoldingResponse | HoldingValidationErrorResponse | HoldingNotFoundErrorResponse> {
    const result = await this.holdingsService.update(id, body);

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
  async delete(
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<HoldingNotFoundErrorResponse | undefined> {
    const deleted = await this.holdingsService.delete(id);

    if (!deleted) {
      res.status(HttpStatus.NOT_FOUND);
      return NOT_FOUND_BODY;
    }

    res.status(HttpStatus.NO_CONTENT);
    return undefined;
  }
}
