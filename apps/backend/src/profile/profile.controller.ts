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
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import type { ProfileErrorResponse, ProfileSummary, SessionUser } from '@vaultfolio/api-contract';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import type { RequestUser } from '../auth/current-user.decorator';
import { Public } from '../auth/public.decorator';
import { clearSessionCookie, SESSION_COOKIE_NAME, setSessionCookie } from '../auth/session-cookie';
import { ProfileService } from './profile.service';
import { TurnstileAction } from '../turnstile/turnstile-action.decorator';
import { TurnstileGuard } from '../turnstile/turnstile.guard';
import { ApiVaultfolioSessionAuth } from '../openapi/api-vaultfolio-auth.decorator';
import { SessionUserDto } from '../openapi/dto/auth';
import {
  ChangePasswordRequestDto,
  ForgotPasswordRequestDto,
  ProfileErrorResponseDto,
  ProfileSummaryDto,
  RequestEmailChangeRequestDto,
  ResetPasswordRequestDto,
  UpdateDisplayNameRequestDto,
  UpdateEmailLanguageRequestDto,
} from '../openapi/dto/profile';

const INVALID_DISPLAY_NAME: ProfileErrorResponse = {
  error: 'invalid_display_name',
  message: 'Display name must be 1–100 characters.',
};
const INVALID_EMAIL_LANGUAGE: ProfileErrorResponse = {
  error: 'invalid_email_language',
  message: 'Email language must be a supported language or unset.',
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
 *
 * Not `@ApiVaultfolioSessionAuth()` at the controller level: this controller
 * mixes protected and `@Public()` routes, and class-level security metadata
 * would be inherited by every method regardless (`@nestjs/swagger`'s
 * class/method metadata merge has no way to "unset" it per route) — so each
 * protected route below carries the decorator itself instead.
 */
@ApiTags('profile')
@Controller('profile')
export class ProfileController {
  constructor(private readonly profile: ProfileService) {}

  @Get()
  @ApiVaultfolioSessionAuth()
  @ApiOperation({ summary: "Get the caller's own profile." })
  @ApiResponse({ status: 200, type: ProfileSummaryDto })
  async getProfile(@CurrentUser() currentUser: RequestUser): Promise<ProfileSummary> {
    const summary = await this.profile.getProfile(currentUser.id);
    // currentUser.id always resolves to an existing row — AuthGuard already
    // verified the session belongs to a live, ACTIVE user this request.
    return summary as ProfileSummary;
  }

  @Patch('display-name')
  @ApiVaultfolioSessionAuth()
  @ApiOperation({ summary: "Update the caller's display name." })
  @ApiResponse({ status: 200, type: ProfileSummaryDto })
  @ApiResponse({
    status: 400,
    description: 'Display name must be 1–100 characters.',
    type: ProfileErrorResponseDto,
  })
  async updateDisplayName(
    @CurrentUser() currentUser: RequestUser,
    @Body() body: UpdateDisplayNameRequestDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ProfileSummary | ProfileErrorResponse> {
    const result = await this.profile.updateDisplayName(currentUser.id, body?.displayName ?? '');
    if (result.kind === 'invalid_display_name') {
      res.status(HttpStatus.BAD_REQUEST);
      return INVALID_DISPLAY_NAME;
    }
    return result.profile;
  }

  @Patch('email-language')
  @ApiVaultfolioSessionAuth()
  @ApiOperation({ summary: "Update the caller's notification email language." })
  @ApiResponse({ status: 200, type: ProfileSummaryDto })
  @ApiResponse({
    status: 400,
    description: 'Email language must be a supported language or unset.',
    type: ProfileErrorResponseDto,
  })
  async updateEmailLanguage(
    @CurrentUser() currentUser: RequestUser,
    @Body() body: UpdateEmailLanguageRequestDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ProfileSummary | ProfileErrorResponse> {
    const result = await this.profile.updateEmailLanguage(
      currentUser.id,
      body?.emailLanguage ?? null,
    );
    if (result.kind === 'invalid_email_language') {
      res.status(HttpStatus.BAD_REQUEST);
      return INVALID_EMAIL_LANGUAGE;
    }
    return result.profile;
  }

  @Post('email-change')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiVaultfolioSessionAuth()
  @ApiOperation({
    summary: 'Request an email change, sending a confirmation link to the new address.',
  })
  @ApiResponse({
    status: 202,
    schema: { type: 'object', properties: { pendingEmail: { type: 'string' } } },
  })
  @ApiResponse({
    status: 409,
    description: "This email can't be used right now.",
    type: ProfileErrorResponseDto,
  })
  @ApiResponse({
    status: 502,
    description: 'Request saved, but the email could not be sent.',
    type: ProfileErrorResponseDto,
  })
  async requestEmailChange(
    @CurrentUser() currentUser: RequestUser,
    @Body() body: RequestEmailChangeRequestDto,
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
  @ApiVaultfolioSessionAuth()
  @ApiOperation({ summary: 'Cancel a pending email change.' })
  @ApiResponse({ status: 204, description: 'Cancelled.' })
  async cancelEmailChange(@CurrentUser() currentUser: RequestUser): Promise<void> {
    await this.profile.cancelEmailChange(currentUser.id);
  }

  @Public()
  @Get('email-change/token/:token')
  @ApiOperation({ summary: "Look up a pending email change's new address by its token." })
  @ApiResponse({
    status: 200,
    schema: { type: 'object', properties: { newEmail: { type: 'string' } } },
  })
  @ApiResponse({
    status: 410,
    description: 'This link is no longer valid.',
    type: ProfileErrorResponseDto,
  })
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
  @ApiOperation({ summary: 'Confirm a pending email change via its emailed token.' })
  @ApiResponse({
    status: 200,
    schema: { type: 'object', properties: { email: { type: 'string' } } },
  })
  @ApiResponse({
    status: 410,
    description: 'This link is no longer valid.',
    type: ProfileErrorResponseDto,
  })
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
  @ApiVaultfolioSessionAuth()
  @ApiOperation({ summary: "Change the caller's password." })
  @ApiResponse({
    status: 200,
    schema: { type: 'object', properties: { changed: { type: 'boolean', enum: [true] } } },
  })
  @ApiResponse({
    status: 401,
    description: 'Current password is incorrect.',
    type: ProfileErrorResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Password must be between 8 and 200 characters.',
    type: ProfileErrorResponseDto,
  })
  async changePassword(
    @CurrentUser() currentUser: RequestUser,
    @Req() req: Request,
    @Body() body: ChangePasswordRequestDto,
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
  @TurnstileAction('forgot-password')
  @UseGuards(TurnstileGuard)
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Request a password-reset email.',
    description: 'Requires a valid Cloudflare Turnstile token (see `turnstileToken`).',
  })
  @ApiResponse({
    status: 200,
    description: 'Always returns { accepted: true } regardless of whether the email exists.',
    schema: { type: 'object', properties: { accepted: { type: 'boolean', enum: [true] } } },
  })
  async forgotPassword(@Body() body: ForgotPasswordRequestDto): Promise<{ accepted: true }> {
    await this.profile.requestPasswordReset(body?.email ?? '');
    return { accepted: true };
  }

  @Public()
  @Get('reset-password/token/:token')
  @ApiOperation({ summary: "Look up a password-reset token's associated account." })
  @ApiResponse({
    status: 200,
    schema: {
      type: 'object',
      properties: {
        valid: { type: 'boolean', enum: [true] },
        displayName: { type: 'string' },
        email: { type: 'string' },
      },
    },
  })
  @ApiResponse({
    status: 410,
    description: 'This link is no longer valid.',
    type: ProfileErrorResponseDto,
  })
  async lookupResetToken(
    @Param('token') token: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ valid: true; displayName: string; email: string } | ProfileErrorResponse> {
    const result = await this.profile.lookupPasswordResetToken(token);
    if (result.kind === 'invalid_token') {
      res.status(HttpStatus.GONE);
      return INVALID_TOKEN;
    }
    return { valid: true, displayName: result.displayName, email: result.email };
  }

  @Public()
  @Post('reset-password/token/:token/confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirm a password reset via its emailed token, starting a session.' })
  @ApiResponse({ status: 200, type: SessionUserDto })
  @ApiResponse({
    status: 400,
    description: 'Password must be between 8 and 200 characters.',
    type: ProfileErrorResponseDto,
  })
  @ApiResponse({
    status: 410,
    description: 'This link is no longer valid.',
    type: ProfileErrorResponseDto,
  })
  async confirmPasswordReset(
    @Param('token') token: string,
    @Body() body: ResetPasswordRequestDto,
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
  @ApiVaultfolioSessionAuth()
  @ApiOperation({ summary: "Delete the caller's own account." })
  @ApiResponse({ status: 204, description: 'Deleted.' })
  @ApiResponse({
    status: 409,
    description: 'Would leave no active administrator.',
    type: ProfileErrorResponseDto,
  })
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
