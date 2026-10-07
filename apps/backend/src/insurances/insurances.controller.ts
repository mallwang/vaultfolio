import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type {
  InsuranceContract,
  InsurancesData,
  InsuranceSettings,
} from '@vaultfolio/api-contract';
import { CurrentUser } from '../auth/current-user.decorator';
import type { RequestUser } from '../auth/current-user.decorator';
import { RequiresDomain } from '../auth/domain.decorator';
import { ApiVaultfolioSessionAuth } from '../openapi/api-vaultfolio-auth.decorator';
import { ApiDomainMaintenanceResponse } from '../openapi/api-domain-maintenance.decorator';
import {
  ErrorResponseDto,
  InsuranceContractDto,
  InsuranceContractInputDto,
  InsuranceSettingsDto,
  InsurancesDataDto,
} from '../openapi/dto';
import { InsurancesAvailableGuard } from './insurances-available.guard';
import { InsurancesService } from './insurances.service';

/**
 * REST surface for `/insurances`, per contracts/insurances-api.md. `AuthGuard`/`DomainGuard` run
 * globally; `InsurancesAvailableGuard` then fails every route closed with 503 without a usable
 * key. Every call reads and writes only the caller's own data. Request bodies are validated by
 * `@vaultfolio/insurances`' strict whitelist, not by a DTO pipe. No totals are computed here.
 */
@ApiTags('insurances')
@ApiVaultfolioSessionAuth()
@ApiDomainMaintenanceResponse()
@Controller('insurances')
@RequiresDomain('insurances')
@UseGuards(InsurancesAvailableGuard)
@ApiResponse({ status: 403, type: ErrorResponseDto, description: 'Domain not entitled.' })
@ApiResponse({
  status: 503,
  type: ErrorResponseDto,
  description: 'INSURANCES_UNAVAILABLE — key missing/invalid.',
})
export class InsurancesController {
  constructor(private readonly insurances: InsurancesService) {}

  @Get()
  @ApiOperation({
    summary: 'Everything the page needs: contracts, linked social lines, settings, server date.',
  })
  @ApiResponse({ status: 200, type: InsurancesDataDto })
  data(@CurrentUser() user: RequestUser): InsurancesData {
    return this.insurances.data(user);
  }

  @Post('contracts')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a contract (at most 200 per user).' })
  @ApiBody({ type: InsuranceContractInputDto })
  @ApiResponse({ status: 201, type: InsuranceContractDto })
  @ApiResponse({
    status: 400,
    type: ErrorResponseDto,
    description: 'INSURANCES_VALIDATION / INSURANCES_UNKNOWN_FIELD / INSURANCES_LIMIT_EXCEEDED.',
  })
  create(@CurrentUser() user: RequestUser, @Body() body: unknown): InsuranceContract {
    return this.insurances.create(user.id, body);
  }

  @Put('contracts/:id')
  @ApiOperation({ summary: 'Replace a contract as a whole.' })
  @ApiBody({ type: InsuranceContractInputDto })
  @ApiResponse({ status: 200, type: InsuranceContractDto })
  @ApiResponse({
    status: 400,
    type: ErrorResponseDto,
    description: 'INSURANCES_VALIDATION / INSURANCES_UNKNOWN_FIELD.',
  })
  @ApiResponse({
    status: 404,
    type: ErrorResponseDto,
    description: 'INSURANCES_CONTRACT_NOT_FOUND.',
  })
  update(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() body: unknown,
  ): InsuranceContract {
    return this.insurances.update(user.id, id, body);
  }

  @Delete('contracts/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete one of the caller’s contracts.' })
  @ApiResponse({ status: 204, description: 'Deleted.' })
  @ApiResponse({
    status: 404,
    type: ErrorResponseDto,
    description: 'INSURANCES_CONTRACT_NOT_FOUND.',
  })
  delete(@CurrentUser() user: RequestUser, @Param('id') id: string): void {
    this.insurances.delete(user.id, id);
  }

  @Put('settings')
  @ApiOperation({ summary: 'Replace profile, reminder preferences, dismissals and toolbar flag.' })
  @ApiBody({ type: InsuranceSettingsDto })
  @ApiResponse({ status: 200, type: InsuranceSettingsDto })
  @ApiResponse({
    status: 400,
    type: ErrorResponseDto,
    description: 'INSURANCES_VALIDATION / INSURANCES_UNKNOWN_FIELD.',
  })
  saveSettings(@CurrentUser() user: RequestUser, @Body() body: unknown): InsuranceSettings {
    return this.insurances.saveSettings(user.id, body);
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete all of the caller's insurance data (the account stays)." })
  @ApiResponse({ status: 204, description: 'Deleted.' })
  deleteAll(@CurrentUser() user: RequestUser): void {
    this.insurances.deleteAll(user.id);
  }
}
