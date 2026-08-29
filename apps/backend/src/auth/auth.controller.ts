import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import type { AuthErrorResponse, SessionUser, SignInRequest } from '@vaultfolio/api-contract';
import { AuthService, toSessionUser } from './auth.service';
import { UsersRepository } from './users.repository';
import { Public } from './public.decorator';
import { CurrentUser } from './current-user.decorator';
import type { RequestUser } from './current-user.decorator';
import { clearSessionCookie, SESSION_COOKIE_NAME, setSessionCookie } from './session-cookie';

const INVALID_CREDENTIALS: AuthErrorResponse = {
  error: 'invalid_credentials',
  message: 'Invalid email or password.',
};

const ACCOUNT_LOCKED: AuthErrorResponse = {
  error: 'account_locked',
  message: 'Too many failed attempts. Try again later.',
};

const UNAUTHENTICATED: AuthErrorResponse = {
  error: 'unauthenticated',
  message: 'Sign in required.',
};

/** REST surface for `/auth`, per contracts/auth-api.md (Principle II). */
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly users: UsersRepository,
  ) {}

  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('sign-in')
  async signIn(
    @Body() body: SignInRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SessionUser | AuthErrorResponse> {
    const result = await this.authService.signIn(body?.email ?? '', body?.password ?? '');

    if (result.kind === 'account_locked') {
      res.status(HttpStatus.TOO_MANY_REQUESTS);
      return ACCOUNT_LOCKED;
    }
    if (result.kind === 'invalid_credentials') {
      res.status(HttpStatus.UNAUTHORIZED);
      return INVALID_CREDENTIALS;
    }

    setSessionCookie(res, result.session.id, new Date(result.session.expiresAt));
    res.status(HttpStatus.OK);
    return result.user;
  }

  @Post('sign-out')
  @HttpCode(HttpStatus.NO_CONTENT)
  async signOut(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    const sessionId = (req.cookies as Record<string, string> | undefined)?.[SESSION_COOKIE_NAME];
    if (sessionId) {
      await this.authService.signOut(sessionId);
    }
    clearSessionCookie(res);
  }

  @Get('session')
  async session(
    @CurrentUser() currentUser: RequestUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SessionUser | AuthErrorResponse> {
    const user = await this.users.findById(currentUser.id);
    if (!user) {
      res.status(HttpStatus.UNAUTHORIZED);
      return UNAUTHENTICATED;
    }
    return toSessionUser(user);
  }
}
