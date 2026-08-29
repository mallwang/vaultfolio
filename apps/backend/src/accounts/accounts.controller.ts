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
import type {
  AccountsErrorResponse,
  AccountSummary,
  ChangeRoleRequest,
} from '@vaultfolio/api-contract';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import type { RequestUser } from '../auth/current-user.decorator';
import { AccountsService } from './accounts.service';

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
const FORBIDDEN: AccountsErrorResponse = {
  error: 'forbidden',
  message: 'You do not have access to this resource.',
};

/** REST surface for `/accounts`, per contracts/accounts-api.md (Principle II). All routes are `@Roles('ADMIN')` — `AuthGuard`/`RolesGuard` run globally (AuthModule). */
@Controller('accounts')
@Roles('ADMIN')
export class AccountsController {
  constructor(private readonly accounts: AccountsService) {}

  @Get()
  async listAll(): Promise<AccountSummary[]> {
    return this.accounts.listAll();
  }

  @Patch(':id/role')
  async changeRole(
    @CurrentUser() currentUser: RequestUser,
    @Param('id') id: string,
    @Body() body: ChangeRoleRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AccountSummary | AccountsErrorResponse> {
    const result = await this.accounts.changeRole(currentUser.id, id, body?.role);

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

  @Post(':id/archive')
  @HttpCode(HttpStatus.OK)
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
