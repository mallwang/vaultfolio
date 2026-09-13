import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { UserRole } from '@vaultfolio/api-contract';
import type {
  SignupsErrorResponse,
  SignupSubmitted,
  SignupSummary,
} from '@vaultfolio/api-contract';
import { ApiForbiddenResponse, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/roles.decorator';
import { Public } from '../auth/public.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import type { RequestUser } from '../auth/current-user.decorator';
import { SignupsService } from './signups.service';
import { TurnstileAction } from '../turnstile/turnstile-action.decorator';
import { TurnstileGuard } from '../turnstile/turnstile.guard';
import { ApiVaultfolioSessionAuth } from '../openapi/api-vaultfolio-auth.decorator';
import { ErrorResponseDto } from '../openapi/dto/error-response';
import {
  CreateSignupRequestDto,
  RejectSignupRequestDto,
  SignupsErrorResponseDto,
  SignupSubmittedDto,
  SignupSummaryDto,
} from '../openapi/dto/signups';

const SIGNUP_DISABLED: SignupsErrorResponse = {
  error: 'signup_disabled',
  message: 'Public sign-up is not available.',
};
const INVALID_PASSWORD: SignupsErrorResponse = {
  error: 'invalid_password',
  message: 'Password must be between 8 and 200 characters.',
};
const EMAIL_UNAVAILABLE: SignupsErrorResponse = {
  error: 'email_unavailable',
  message: "This email can't be used to sign up right now.",
};
const SIGNUP_EMAIL_DELIVERY_FAILED: SignupsErrorResponse = {
  error: 'email_delivery_failed',
  message: 'Sign-up saved, but the verification email could not be sent.',
};
const VERIFY_EMAIL_DELIVERY_FAILED: SignupsErrorResponse = {
  error: 'email_delivery_failed',
  message: 'Verified, but admin notification could not be sent.',
};
const INVALID_TOKEN: SignupsErrorResponse = {
  error: 'invalid_token',
  message: 'This verification link is no longer valid.',
};
const NOT_FOUND: SignupsErrorResponse = {
  error: 'not_found',
  message: 'Sign-up request not found.',
};
const NOT_VERIFIED: SignupsErrorResponse = {
  error: 'not_verified',
  message: 'Only verified sign-up requests can be resolved.',
};
const ALREADY_RESOLVED: SignupsErrorResponse = {
  error: 'already_resolved',
  message: 'This sign-up request was already resolved.',
};
const APPROVE_EMAIL_DELIVERY_FAILED: SignupsErrorResponse = {
  error: 'email_delivery_failed',
  message: 'Account created, but the welcome email could not be sent.',
};
const REJECT_EMAIL_DELIVERY_FAILED: SignupsErrorResponse = {
  error: 'email_delivery_failed',
  message: 'Rejected, but the notification email could not be sent.',
};

function isSignupEnabled(): boolean {
  return process.env.PUBLIC_SIGNUP_ENABLED !== 'false';
}

/**
 * REST surface for `/signups`, per contracts/signups-api.md. Two audiences
 * share this controller, mirroring `InvitationsController`'s mixed-audience
 * shape: visitor-facing routes (`@Public()`) and admin-facing routes
 * (`@Roles('ADMIN')`). Visitor-facing routes short-circuit to `403
 * signup_disabled` when `PUBLIC_SIGNUP_ENABLED=false`; admin routes remain
 * available regardless of the toggle so queued requests can still be
 * resolved.
 */
@ApiTags('signups')
@Controller('signups')
export class SignupsController {
  constructor(private readonly signupsService: SignupsService) {}

  @Public()
  @TurnstileAction('signup')
  @UseGuards(TurnstileGuard)
  @Post()
  @ApiOperation({
    summary: 'Submit a self-service sign-up request.',
    description: 'Requires a valid Cloudflare Turnstile token (see `turnstileToken`).',
  })
  @ApiResponse({ status: 201, type: SignupSubmittedDto })
  @ApiResponse({
    status: 400,
    description: 'Password must be between 8 and 200 characters.',
    type: SignupsErrorResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Public sign-up is not available, or the Turnstile check failed.',
    type: SignupsErrorResponseDto,
  })
  @ApiResponse({
    status: 409,
    description: "This email can't be used to sign up right now.",
    type: SignupsErrorResponseDto,
  })
  @ApiResponse({
    status: 502,
    description: 'Sign-up saved, but the verification email could not be sent.',
    type: SignupsErrorResponseDto,
  })
  async submit(
    @Body() body: CreateSignupRequestDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SignupSubmitted | SignupsErrorResponse> {
    if (!isSignupEnabled()) {
      res.status(HttpStatus.FORBIDDEN);
      return SIGNUP_DISABLED;
    }

    const result = await this.signupsService.submit(body?.email ?? '', body?.password ?? '');

    if (result.kind === 'invalid_password') {
      res.status(HttpStatus.BAD_REQUEST);
      return INVALID_PASSWORD;
    }
    if (result.kind === 'email_unavailable') {
      res.status(HttpStatus.CONFLICT);
      return EMAIL_UNAVAILABLE;
    }
    if (result.kind === 'email_delivery_failed') {
      res.status(HttpStatus.BAD_GATEWAY);
      return SIGNUP_EMAIL_DELIVERY_FAILED;
    }
    res.status(HttpStatus.CREATED);
    return { email: result.request.email };
  }

  @Public()
  @Get('token/:token')
  @ApiOperation({ summary: "Look up a sign-up request's email by its verification token." })
  @ApiResponse({
    status: 200,
    schema: { type: 'object', properties: { email: { type: 'string' } } },
  })
  @ApiResponse({
    status: 410,
    description: 'This verification link is no longer valid.',
    type: SignupsErrorResponseDto,
  })
  async lookupToken(
    @Param('token') token: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ email: string } | SignupsErrorResponse> {
    const result = await this.signupsService.lookupByToken(token);
    if (result.kind === 'invalid_token') {
      res.status(HttpStatus.GONE);
      return INVALID_TOKEN;
    }
    return { email: result.email };
  }

  @Public()
  @Post('token/:token/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify a sign-up request via its emailed token.' })
  @ApiResponse({
    status: 200,
    schema: {
      type: 'object',
      properties: { email: { type: 'string' }, status: { type: 'string', enum: ['VERIFIED'] } },
    },
  })
  @ApiResponse({
    status: 410,
    description: 'This verification link is no longer valid.',
    type: SignupsErrorResponseDto,
  })
  @ApiResponse({
    status: 502,
    description: 'Verified, but admin notification could not be sent.',
    type: SignupsErrorResponseDto,
  })
  async verify(
    @Param('token') token: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ email: string; status: 'VERIFIED' } | SignupsErrorResponse> {
    const result = await this.signupsService.verify(token);

    if (result.kind === 'invalid_token') {
      res.status(HttpStatus.GONE);
      return INVALID_TOKEN;
    }
    if (result.kind === 'email_delivery_failed') {
      res.status(HttpStatus.BAD_GATEWAY);
      return VERIFY_EMAIL_DELIVERY_FAILED;
    }
    return { email: result.request.email, status: 'VERIFIED' };
  }

  @Roles(UserRole.ADMIN)
  @Get()
  @ApiVaultfolioSessionAuth()
  @ApiForbiddenResponse({ description: 'Caller is not an administrator.', type: ErrorResponseDto })
  @ApiOperation({ summary: 'List every sign-up request (admin only).' })
  @ApiResponse({ status: 200, type: [SignupSummaryDto] })
  async list(): Promise<SignupSummary[]> {
    return this.signupsService.list();
  }

  @Roles(UserRole.ADMIN)
  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @ApiVaultfolioSessionAuth()
  @ApiForbiddenResponse({ description: 'Caller is not an administrator.', type: ErrorResponseDto })
  @ApiOperation({
    summary: 'Approve a verified sign-up request, creating its account (admin only).',
  })
  @ApiResponse({ status: 200, type: SignupSummaryDto })
  @ApiResponse({ status: 404, description: 'Not found.', type: SignupsErrorResponseDto })
  @ApiResponse({
    status: 400,
    description: 'Only verified sign-up requests can be resolved.',
    type: SignupsErrorResponseDto,
  })
  @ApiResponse({
    status: 409,
    description: 'This sign-up request was already resolved.',
    type: SignupsErrorResponseDto,
  })
  @ApiResponse({
    status: 502,
    description: 'Account created, but the welcome email could not be sent.',
    type: SignupsErrorResponseDto,
  })
  async approve(
    @CurrentUser() currentUser: RequestUser,
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SignupSummary | SignupsErrorResponse> {
    const result = await this.signupsService.approve(id, currentUser.id);
    return this.mapResolveResult(result, res, APPROVE_EMAIL_DELIVERY_FAILED);
  }

  @Roles(UserRole.ADMIN)
  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  @ApiVaultfolioSessionAuth()
  @ApiForbiddenResponse({ description: 'Caller is not an administrator.', type: ErrorResponseDto })
  @ApiOperation({ summary: 'Reject a verified sign-up request (admin only).' })
  @ApiResponse({ status: 200, type: SignupSummaryDto })
  @ApiResponse({ status: 404, description: 'Not found.', type: SignupsErrorResponseDto })
  @ApiResponse({
    status: 400,
    description: 'Only verified sign-up requests can be resolved.',
    type: SignupsErrorResponseDto,
  })
  @ApiResponse({
    status: 409,
    description: 'This sign-up request was already resolved.',
    type: SignupsErrorResponseDto,
  })
  @ApiResponse({
    status: 502,
    description: 'Rejected, but the notification email could not be sent.',
    type: SignupsErrorResponseDto,
  })
  async reject(
    @CurrentUser() currentUser: RequestUser,
    @Param('id') id: string,
    @Body() body: RejectSignupRequestDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SignupSummary | SignupsErrorResponse> {
    const result = await this.signupsService.reject(id, currentUser.id, body?.reason);
    return this.mapResolveResult(result, res, REJECT_EMAIL_DELIVERY_FAILED);
  }

  @Roles(UserRole.ADMIN)
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiVaultfolioSessionAuth()
  @ApiForbiddenResponse({ description: 'Caller is not an administrator.', type: ErrorResponseDto })
  @ApiOperation({ summary: 'Delete a resolved sign-up request (admin only).' })
  @ApiResponse({
    status: 200,
    schema: { type: 'object', properties: { deleted: { type: 'boolean', enum: [true] } } },
  })
  @ApiResponse({ status: 404, description: 'Not found.', type: SignupsErrorResponseDto })
  async delete(
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ deleted: true } | SignupsErrorResponse> {
    const result = await this.signupsService.delete(id);
    if (result.kind === 'not_found') {
      res.status(HttpStatus.NOT_FOUND);
      return NOT_FOUND;
    }
    return { deleted: true };
  }

  private mapResolveResult(
    result:
      | {
          kind: 'success';
          request: {
            id: string;
            email: string;
            status: string;
            createdAt: string;
            verifiedAt: string | null;
            resolvedAt: string | null;
            accountDeletedAt: string | null;
          };
        }
      | { kind: 'not_found' }
      | { kind: 'not_verified' }
      | { kind: 'already_resolved' }
      | {
          kind: 'email_delivery_failed';
          request: {
            id: string;
            email: string;
            status: string;
            createdAt: string;
            verifiedAt: string | null;
            resolvedAt: string | null;
            accountDeletedAt: string | null;
          };
        },
    res: Response,
    emailDeliveryFailedResponse: SignupsErrorResponse,
  ): SignupSummary | SignupsErrorResponse {
    if (result.kind === 'not_found') {
      res.status(HttpStatus.NOT_FOUND);
      return NOT_FOUND;
    }
    if (result.kind === 'not_verified') {
      res.status(HttpStatus.BAD_REQUEST);
      return NOT_VERIFIED;
    }
    if (result.kind === 'already_resolved') {
      res.status(HttpStatus.CONFLICT);
      return ALREADY_RESOLVED;
    }
    if (result.kind === 'email_delivery_failed') {
      res.status(HttpStatus.BAD_GATEWAY);
      return emailDeliveryFailedResponse;
    }
    return {
      id: result.request.id,
      email: result.request.email,
      status: result.request.status as SignupSummary['status'],
      createdAt: result.request.createdAt,
      verifiedAt: result.request.verifiedAt,
      resolvedAt: result.request.resolvedAt,
      accountDeletedAt: result.request.accountDeletedAt,
    };
  }
}
