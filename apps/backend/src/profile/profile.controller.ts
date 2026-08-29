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
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import type {
  ChangePasswordRequest,
  ForgotPasswordRequest,
  ProfileErrorResponse,
  ProfileSummary,
  RequestEmailChangeRequest,
  ResetPasswordRequest,
  SessionUser,
  UpdateDisplayNameRequest,
} from '@vaultfolio/api-contract';
import { CurrentUser } from '../auth/current-user.decorator';
import type { RequestUser } from '../auth/current-user.decorator';
import { Public } from '../auth/public.decorator';
import { clearSessionCookie, SESSION_COOKIE_NAME, setSessionCookie } from '../auth/session-cookie';
import { ProfileService } from './profile.service';

const INVALID_DISPLAY_NAME: ProfileErrorResponse = {
  error: 'invalid_display_name',
  message: 'Display name must be 1–100 characters.',
};
const EMAIL_UNAVAILABLE: ProfileErrorResponse = {
  error: 'email_unavailable',
  message: "This email can't be used right now.",
};
const EMAIL_DELIVERY_FAILED: ProfileErrorResponse = {
  error: 'email_delivery_failed',
  message: 'Request saved, but the email could not be sent.',
};
const INVALID_TOKEN: ProfileErrorResponse = {
  error: 'invalid_token',
  message: 'This link is no longer valid.',
};
const INVALID_PASSWORD: ProfileErrorResponse = {
  error: 'invalid_password',
  message: 'Password must be between 8 and 200 characters.',
};
const INVALID_CURRENT_PASSWORD: ProfileErrorResponse = {
  error: 'invalid_current_password',
  message: 'Current password is incorrect.',
};
const LAST_ADMIN: ProfileErrorResponse = {
  error: 'last_admin',
  message: 'At least one active administrator must remain.',
};
const DELETION_FAILED: ProfileErrorResponse = {
  error: 'deletion_failed',
  message: 'Something went wrong. Your account was not changed.',
};

function currentSessionId(req: Request): string {
  return (req.cookies as Record<string, string> | undefined)?.[SESSION_COOKIE_NAME] ?? '';
}

/**
 * REST surface for `/profile`, per contracts/profile-api.md. Every
 * authenticated route carries no `@Roles()` — every signed-in user, `ADMIN`
 * or `MEMBER`, may call it (closes research.md #1's reachability gap). The
 * forgot/reset/verify-email routes are `@Public()` since the caller may have
 * no session at that point.
 */
@Controller('profile')
export class ProfileController {
  constructor(private readonly profile: ProfileService) {}

  @Get()
  async getProfile(@CurrentUser() currentUser: RequestUser): Promise<ProfileSummary> {
    const summary = await this.profile.getProfile(currentUser.id);
    // currentUser.id always resolves to an existing row — AuthGuard already
    // verified the session belongs to a live, ACTIVE user this request.
    return summary as ProfileSummary;
  }

  @Patch('display-name')
  async updateDisplayName(
    @CurrentUser() currentUser: RequestUser,
    @Body() body: UpdateDisplayNameRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ProfileSummary | ProfileErrorResponse> {
    const result = await this.profile.updateDisplayName(currentUser.id, body?.displayName ?? '');
    if (result.kind === 'invalid_display_name') {
      res.status(HttpStatus.BAD_REQUEST);
      return INVALID_DISPLAY_NAME;
    }
    return result.profile;
  }

  @Post('email-change')
  @HttpCode(HttpStatus.ACCEPTED)
  async requestEmailChange(
    @CurrentUser() currentUser: RequestUser,
    @Body() body: RequestEmailChangeRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ pendingEmail: string } | ProfileErrorResponse> {
    const result = await this.profile.requestEmailChange(currentUser.id, body?.newEmail ?? '');
    if (result.kind === 'email_unavailable') {
      res.status(HttpStatus.CONFLICT);
      return EMAIL_UNAVAILABLE;
    }
    if (result.kind === 'email_delivery_failed') {
      res.status(HttpStatus.BAD_GATEWAY);
      return EMAIL_DELIVERY_FAILED;
    }
    return { pendingEmail: result.pendingEmail };
  }

  @Post('email-change/cancel')
  @HttpCode(HttpStatus.NO_CONTENT)
  async cancelEmailChange(@CurrentUser() currentUser: RequestUser): Promise<void> {
    await this.profile.cancelEmailChange(currentUser.id);
  }

  @Public()
  @Get('email-change/token/:token')
  async lookupEmailChangeToken(
    @Param('token') token: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ newEmail: string } | ProfileErrorResponse> {
    const result = await this.profile.lookupEmailChangeToken(token);
    if (result.kind === 'invalid_token') {
      res.status(HttpStatus.GONE);
      return INVALID_TOKEN;
    }
    return { newEmail: result.newEmail };
  }

  @Public()
  @Post('email-change/token/:token/confirm')
  @HttpCode(HttpStatus.OK)
  async confirmEmailChange(
    @Param('token') token: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ email: string } | ProfileErrorResponse> {
    const result = await this.profile.confirmEmailChange(token);
    if (result.kind === 'invalid_token') {
      res.status(HttpStatus.GONE);
      return INVALID_TOKEN;
    }
    return { email: result.email };
  }

  @Post('password')
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @CurrentUser() currentUser: RequestUser,
    @Req() req: Request,
    @Body() body: ChangePasswordRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ changed: true } | ProfileErrorResponse> {
    const result = await this.profile.changePassword(
      currentUser.id,
      currentSessionId(req),
      body?.currentPassword ?? '',
      body?.newPassword ?? '',
    );
    if (result.kind === 'invalid_current_password') {
      res.status(HttpStatus.UNAUTHORIZED);
      return INVALID_CURRENT_PASSWORD;
    }
    if (result.kind === 'invalid_password') {
      res.status(HttpStatus.BAD_REQUEST);
      return INVALID_PASSWORD;
    }
    return { changed: true };
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() body: ForgotPasswordRequest): Promise<{ accepted: true }> {
    await this.profile.requestPasswordReset(body?.email ?? '');
    return { accepted: true };
  }

  @Public()
  @Get('reset-password/token/:token')
  async lookupResetToken(
    @Param('token') token: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ valid: true } | ProfileErrorResponse> {
    const result = await this.profile.lookupPasswordResetToken(token);
    if (result.kind === 'invalid_token') {
      res.status(HttpStatus.GONE);
      return INVALID_TOKEN;
    }
    return { valid: true };
  }

  @Public()
  @Post('reset-password/token/:token/confirm')
  @HttpCode(HttpStatus.OK)
  async confirmPasswordReset(
    @Param('token') token: string,
    @Body() body: ResetPasswordRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SessionUser | ProfileErrorResponse> {
    const result = await this.profile.confirmPasswordReset(token, body?.newPassword ?? '');
    if (result.kind === 'invalid_password') {
      res.status(HttpStatus.BAD_REQUEST);
      return INVALID_PASSWORD;
    }
    if (result.kind === 'invalid_token') {
      res.status(HttpStatus.GONE);
      return INVALID_TOKEN;
    }

    setSessionCookie(res, result.session.id, new Date(result.session.expiresAt));
    return result.user;
  }

  @Delete('account')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteAccount(
    @CurrentUser() currentUser: RequestUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ProfileErrorResponse | void> {
    const result = await this.profile.deleteAccount(currentUser.id);
    if (result.kind === 'last_admin') {
      res.status(HttpStatus.CONFLICT);
      return LAST_ADMIN;
    }
    if (result.kind === 'deletion_failed') {
      res.status(HttpStatus.INTERNAL_SERVER_ERROR);
      return DELETION_FAILED;
    }
    clearSessionCookie(res);
  }
}
