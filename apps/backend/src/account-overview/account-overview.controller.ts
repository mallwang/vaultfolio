import { Body, Controller, Delete, Get, HttpStatus, Param, Post, Put, Res } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import type {
  AccountOverviewEntry,
  AccountOverviewNotFoundErrorResponse,
  AccountOverviewValidationErrorResponse,
} from '@vaultfolio/api-contract';
import type { FieldError } from '@vaultfolio/domain-accounts';
import { AccountOverviewService } from './account-overview.service';
import { accountToResponse } from './account-overview.mapper';
import { CurrentUser } from '../auth/current-user.decorator';
import type { RequestUser } from '../auth/current-user.decorator';
import { RequiresDomain } from '../auth/domain.decorator';
import { ApiVaultfolioSessionAuth } from '../openapi/api-vaultfolio-auth.decorator';
import {
  AccountOverviewEntryDto,
  AccountOverviewNotFoundErrorResponseDto,
  AccountOverviewValidationErrorResponseDto,
  CreateAccountOverviewEntryRequestDto,
  UpdateAccountOverviewEntryRequestDto,
} from '../openapi/dto/account-overview';

function validationErrorBody(fieldErrors: FieldError[]): AccountOverviewValidationErrorResponse {
  return {
    error: 'VALIDATION_FAILED',
    message: 'One or more fields are invalid.',
    fieldErrors,
  };
}

const NOT_FOUND_BODY: AccountOverviewNotFoundErrorResponse = {
  error: 'ACCOUNT_NOT_FOUND',
  message: 'This account no longer exists.',
};

/**
 * REST surface for `/account-overview/accounts`, per
 * contracts/account-overview-api.md (Principle II).
 * `@RequiresDomain('account-overview')` — `AuthGuard`/`DomainGuard` run
 * globally (`AuthModule`) — mirrors `HoldingsController`'s
 * `@RequiresDomain('holdings')`.
 */
@ApiTags('account-overview')
@ApiVaultfolioSessionAuth()
@Controller('account-overview/accounts')
@RequiresDomain('account-overview')
export class AccountOverviewController {
  constructor(private readonly accountOverviewService: AccountOverviewService) {}

  @Get()
  @ApiOperation({ summary: "List the caller's account-overview entries." })
  @ApiResponse({ status: 200, type: [AccountOverviewEntryDto] })
  async list(@CurrentUser() user: RequestUser): Promise<AccountOverviewEntry[]> {
    const accounts = await this.accountOverviewService.findAll(user.id);
    return accounts.map(accountToResponse);
  }

  @Post()
  @ApiOperation({ summary: 'Create an account-overview entry.' })
  @ApiResponse({ status: 201, type: AccountOverviewEntryDto })
  @ApiResponse({
    status: 400,
    description: 'One or more fields are invalid.',
    type: AccountOverviewValidationErrorResponseDto,
  })
  async create(
    @Body() body: CreateAccountOverviewEntryRequestDto,
    @CurrentUser() user: RequestUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AccountOverviewEntry | AccountOverviewValidationErrorResponse> {
    const result = await this.accountOverviewService.create(body, user.id);

    if (result.kind === 'invalid') {
      res.status(HttpStatus.BAD_REQUEST);
      return validationErrorBody(result.fieldErrors);
    }

    res.status(HttpStatus.CREATED);
    return accountToResponse(result.account);
  }

  @Put(':id')
  @ApiOperation({
    summary:
      'Update an account-overview entry. Every field is optional; an omitted field is left unchanged.',
  })
  @ApiResponse({ status: 200, type: AccountOverviewEntryDto })
  @ApiResponse({
    status: 400,
    description: 'One or more fields are invalid.',
    type: AccountOverviewValidationErrorResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'This account no longer exists.',
    type: AccountOverviewNotFoundErrorResponseDto,
  })
  async update(
    @Param('id') id: string,
    @Body() body: UpdateAccountOverviewEntryRequestDto,
    @CurrentUser() user: RequestUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<
    | AccountOverviewEntry
    | AccountOverviewValidationErrorResponse
    | AccountOverviewNotFoundErrorResponse
  > {
    const result = await this.accountOverviewService.update(id, body, user.id);

    if (result.kind === 'not_found') {
      res.status(HttpStatus.NOT_FOUND);
      return NOT_FOUND_BODY;
    }
    if (result.kind === 'invalid') {
      res.status(HttpStatus.BAD_REQUEST);
      return validationErrorBody(result.fieldErrors);
    }

    res.status(HttpStatus.OK);
    return accountToResponse(result.account);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an account-overview entry.' })
  @ApiResponse({ status: 204, description: 'Deleted.' })
  @ApiResponse({
    status: 404,
    description: 'This account no longer exists.',
    type: AccountOverviewNotFoundErrorResponseDto,
  })
  async delete(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AccountOverviewNotFoundErrorResponse | undefined> {
    const deleted = await this.accountOverviewService.delete(id, user.id);

    if (!deleted) {
      res.status(HttpStatus.NOT_FOUND);
      return NOT_FOUND_BODY;
    }

    res.status(HttpStatus.NO_CONTENT);
    return undefined;
  }
}
