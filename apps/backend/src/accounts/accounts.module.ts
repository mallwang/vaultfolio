import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AccountsController } from './accounts.controller';
import { AccountsService } from './accounts.service';
import { RetentionSweepService } from './retention-sweep.service';

/** `AuthModule` exports `UsersRepository`/`SessionsRepository` — reused here rather than re-provided. */
@Module({
  imports: [AuthModule],
  controllers: [AccountsController],
  providers: [AccountsService, RetentionSweepService],
})
export class AccountsModule {}
