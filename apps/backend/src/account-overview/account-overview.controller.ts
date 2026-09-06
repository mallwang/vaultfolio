import { Body, Controller, Delete, Get, HttpStatus, Param, Post, Put, Res } from '@nestjs/common';
import type { Response } from 'express';
import type {
  AccountOverviewEntry,
  AccountOverviewNotFoundErrorResponse,
  AccountOverviewValidationErrorResponse,
  CreateAccountOverviewEntryRequest,
  UpdateAccountOverviewEntryRequest,
} from '@vaultfolio/api-contract';
import type { FieldError } from '@vaultfolio/domain-accounts';
import { AccountOverviewService } from './account-overview.service';
import { accountToResponse } from './account-overview.mapper';
import { CurrentUser } from '../auth/current-user.decorator';
import type { RequestUser } from '../auth/current-user.decorator';
import { RequiresDomain } from '../auth/domain.decorator';

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
@Controller('account-overview/accounts')
@RequiresDomain('account-overview')
export class AccountOverviewController {
  constructor(private readonly accountOverviewService: AccountOverviewService) {}

  @Get()
  async list(@CurrentUser() user: RequestUser): Promise<AccountOverviewEntry[]> {
    const accounts = await this.accountOverviewService.findAll(user.id);
    return accounts.map(accountToResponse);
  }

  @Post()
  async create(
    @Body() body: CreateAccountOverviewEntryRequest,
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
  async update(
    @Param('id') id: string,
    @Body() body: UpdateAccountOverviewEntryRequest,
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
