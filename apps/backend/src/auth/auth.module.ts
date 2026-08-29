import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UsersRepository } from './users.repository';
import { SessionsRepository } from './sessions.repository';
import { AuthGuard } from './auth.guard';
import { RolesGuard } from './roles.guard';

@Module({
  imports: [
    // Secondary, per-IP rate limit on login volume (research.md #3) —
    // defense-in-depth alongside the per-account lockout in AuthService.
    // Applied only to POST /auth/sign-in (via @Throttle there), not
    // globally, so it never interferes with normal traffic on other routes.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 20 }]),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    UsersRepository,
    SessionsRepository,
    // Order matters: AuthGuard (authentication) must run before RolesGuard
    // (authorization) so `request.user` exists by the time roles are
    // checked. Nest runs APP_GUARD providers in registration order.
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  exports: [UsersRepository, SessionsRepository],
})
export class AuthModule {}
