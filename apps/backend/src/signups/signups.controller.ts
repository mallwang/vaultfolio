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
} from '@nestjs/common';
import type { Response } from 'express';
import type {
  CreateSignupRequest,
  RejectSignupRequest,
  SignupsErrorResponse,
  SignupSubmitted,
  SignupSummary,
} from '@vaultfolio/api-contract';
import { Roles } from '../auth/roles.decorator';
import { Public } from '../auth/public.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import type { RequestUser } from '../auth/current-user.decorator';
import { SignupsService } from './signups.service';

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
@Controller('signups')
export class SignupsController {
  constructor(private readonly signupsService: SignupsService) {}

  @Public()
  @Post()
  async submit(
    @Body() body: CreateSignupRequest,
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

  @Roles('ADMIN')
  @Get()
  async list(): Promise<SignupSummary[]> {
    return this.signupsService.list();
  }

  @Roles('ADMIN')
  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  async approve(
    @CurrentUser() currentUser: RequestUser,
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SignupSummary | SignupsErrorResponse> {
    const result = await this.signupsService.approve(id, currentUser.id);
    return this.mapResolveResult(result, res, APPROVE_EMAIL_DELIVERY_FAILED);
  }

  @Roles('ADMIN')
  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  async reject(
    @CurrentUser() currentUser: RequestUser,
    @Param('id') id: string,
    @Body() body: RejectSignupRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SignupSummary | SignupsErrorResponse> {
    const result = await this.signupsService.reject(id, currentUser.id, body?.reason);
    return this.mapResolveResult(result, res, REJECT_EMAIL_DELIVERY_FAILED);
  }

  @Roles('ADMIN')
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
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
    };
  }
}
