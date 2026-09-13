import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { UserRole } from '@vaultfolio/api-contract';
import type { AccountsErrorResponse, AccountSummary } from '@vaultfolio/api-contract';
import { ApiForbiddenResponse, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import type { RequestUser } from '../auth/current-user.decorator';
import { AccountsService } from './accounts.service';
import { ApiVaultfolioSessionAuth } from '../openapi/api-vaultfolio-auth.decorator';
import {
  AccountSummaryDto,
  AccountsErrorResponseDto,
  ChangeDomainScopesRequestDto,
  ChangeRoleRequestDto,
} from '../openapi/dto/accounts';
import { ErrorResponseDto } from '../openapi/dto/error-response';

const NOT_FOUND: AccountsErrorResponse = { error: 'not_found', message: 'Account not found.' };
const LAST_ADMIN: AccountsErrorResponse = {
  error: 'last_admin',
  message: 'At least one active administrator must remain.',
};
const ALREADY_ARCHIVED: AccountsErrorResponse = {
  error: 'already_archived',
  message: 'This account was already archived.',
};
const RETENTION_EXPIRED: AccountsErrorResponse = {
  error: 'retention_expired',
  message: "This account's retention window has passed.",
};
const INVALID_DOMAIN: AccountsErrorResponse = {
  error: 'invalid_domain',
  message: 'One or more domain ids are not recognized.',
};
const FORBIDDEN: AccountsErrorResponse = {
  error: 'forbidden',
  message: 'You do not have access to this resource.',
};

/** REST surface for `/accounts`, per contracts/accounts-api.md (Principle II). All routes are `@Roles('ADMIN')` — `AuthGuard`/`RolesGuard` run globally (AuthModule). */
@ApiTags('accounts')
@ApiVaultfolioSessionAuth()
@ApiForbiddenResponse({ description: 'Caller is not an administrator.', type: ErrorResponseDto })
@Controller('accounts')
@Roles(UserRole.ADMIN)
export class AccountsController {
  constructor(private readonly accounts: AccountsService) {}

  @Get()
  @ApiOperation({ summary: 'List every account (admin only).' })
  @ApiResponse({ status: 200, type: [AccountSummaryDto] })
  async listAll(): Promise<AccountSummary[]> {
    return this.accounts.listAll();
  }

  @Patch(':id/role')
  @ApiOperation({ summary: "Change an account's role." })
  @ApiResponse({ status: 200, type: AccountSummaryDto })
  @ApiResponse({ status: 404, description: 'Account not found.', type: AccountsErrorResponseDto })
  @ApiResponse({
    status: 409,
    description: 'Would leave no active administrator.',
    type: AccountsErrorResponseDto,
  })
  async changeRole(
    @CurrentUser() currentUser: RequestUser,
    @Param('id') id: string,
    @Body() body: ChangeRoleRequestDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AccountSummary | AccountsErrorResponse> {
    const result = await this.accounts.changeRole(currentUser.id, id, body?.role);

    if (result.kind === 'forbidden') {
      res.status(HttpStatus.FORBIDDEN);
      return FORBIDDEN;
    }
    if (result.kind === 'not_found') {
      res.status(HttpStatus.NOT_FOUND);
      return NOT_FOUND;
    }
    if (result.kind === 'last_admin') {
      res.status(HttpStatus.CONFLICT);
      return LAST_ADMIN;
    }
    return result.account;
  }

  @Patch(':id/domain-scopes')
  @ApiOperation({ summary: "Change an account's domain scopes." })
  @ApiResponse({ status: 200, type: AccountSummaryDto })
  @ApiResponse({ status: 404, description: 'Account not found.', type: AccountsErrorResponseDto })
  @ApiResponse({
    status: 400,
    description: 'One or more domain ids are not recognized.',
    type: AccountsErrorResponseDto,
  })
  async changeDomainScopes(
    @CurrentUser() currentUser: RequestUser,
    @Param('id') id: string,
    @Body() body: ChangeDomainScopesRequestDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AccountSummary | AccountsErrorResponse> {
    const result = await this.accounts.changeDomainScopes(currentUser.id, id, body?.domainScopes);

    if (result.kind === 'not_found') {
      res.status(HttpStatus.NOT_FOUND);
      return NOT_FOUND;
    }
    if (result.kind === 'invalid_domain') {
      res.status(HttpStatus.BAD_REQUEST);
      return INVALID_DOMAIN;
    }
    return result.account;
  }

  @Post(':id/archive')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Archive an account.' })
  @ApiResponse({ status: 200, type: AccountSummaryDto })
  @ApiResponse({ status: 404, description: 'Account not found.', type: AccountsErrorResponseDto })
  @ApiResponse({
    status: 409,
    description: 'Would leave no active administrator, or already archived.',
    type: AccountsErrorResponseDto,
  })
  async archive(
    @CurrentUser() currentUser: RequestUser,
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AccountSummary | AccountsErrorResponse> {
    const result = await this.accounts.archive(currentUser.id, id);

    if (result.kind === 'not_found') {
      res.status(HttpStatus.NOT_FOUND);
      return NOT_FOUND;
    }
    if (result.kind === 'last_admin') {
      res.status(HttpStatus.CONFLICT);
      return LAST_ADMIN;
    }
    if (result.kind === 'already_archived') {
      res.status(HttpStatus.CONFLICT);
      return ALREADY_ARCHIVED;
    }
    return result.account;
  }

  @Post(':id/reactivate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reactivate an archived account, within its retention window.' })
  @ApiResponse({ status: 200, type: AccountSummaryDto })
  @ApiResponse({ status: 404, description: 'Account not found.', type: AccountsErrorResponseDto })
  @ApiResponse({
    status: 410,
    description: "This account's retention window has passed.",
    type: AccountsErrorResponseDto,
  })
  async reactivate(
    @CurrentUser() currentUser: RequestUser,
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AccountSummary | AccountsErrorResponse> {
    const result = await this.accounts.reactivate(currentUser.id, id);

    if (result.kind === 'not_found') {
      res.status(HttpStatus.NOT_FOUND);
      return NOT_FOUND;
    }
    if (result.kind === 'retention_expired') {
      res.status(HttpStatus.GONE);
      return RETENTION_EXPIRED;
    }
    return result.account;
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Permanently delete an account past its retention window.' })
  @ApiResponse({ status: 204, description: 'Deleted.' })
  @ApiResponse({
    status: 409,
    description: 'Would leave no active administrator.',
    type: AccountsErrorResponseDto,
  })
  async deleteSelf(
    @CurrentUser() currentUser: RequestUser,
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AccountsErrorResponse | void> {
    const result = await this.accounts.deleteSelf(currentUser.id, id);

    if (result.kind === 'forbidden') {
      res.status(HttpStatus.FORBIDDEN);
      return FORBIDDEN;
    }
    if (result.kind === 'last_admin') {
      res.status(HttpStatus.CONFLICT);
      return LAST_ADMIN;
    }
  }
}
