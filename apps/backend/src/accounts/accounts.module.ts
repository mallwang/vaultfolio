import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AccountsController } from './accounts.controller';
import { AccountsService } from './accounts.service';
import { RetentionSweepService } from './retention-sweep.service';

/**
 * `AuthModule` exports `UsersRepository`/`SessionsRepository` — reused here
 * rather than re-provided. `AccountsService` is exported so `ProfileModule`
 * (008) can reuse `deleteSelf` for self-service account deletion without
 * duplicating its last-admin logic (research.md #1).
 */
@Module({
  imports: [AuthModule],
  controllers: [AccountsController],
  providers: [AccountsService, RetentionSweepService],
  exports: [AccountsService],
})
export class AccountsModule {}
