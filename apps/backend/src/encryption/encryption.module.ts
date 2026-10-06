import { Global, Module } from '@nestjs/common';
import { DomainKeyringService } from './domain-keyring.service';
import { EncryptionAdminController } from './encryption-admin.controller';
import { KeyStoreRepository } from './key-store.repository';
import { LegacyMigrationService } from './legacy-migration.service';
import { RotationService } from './rotation.service';

@Global()
@Module({
  controllers: [EncryptionAdminController],
  providers: [KeyStoreRepository, LegacyMigrationService, DomainKeyringService, RotationService],
  exports: [DomainKeyringService],
})
export class EncryptionModule {}
